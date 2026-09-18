"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextNumber, writeAuditLog } from "@/lib/utils";

export async function createReceiving(
  deliveryId: string,
  formData: FormData,
): Promise<{ error?: string; redirect?: string }> {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") return { error: "Unauthorized" };

  const warehouseId = dbUser?.warehouseId;
  if (!warehouseId) return { error: "Anda tidak terhubung ke warehouse manapun" };

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      purchaseOrder: true,
      details: { include: { purchaseOrderDetail: true } },
      receivings: { include: { details: true } },
    },
  });
  if (!delivery) return { error: "Delivery tidak ditemukan" };
  if (delivery.status === "CANCELLED") return { error: "Delivery ini telah dibatalkan oleh supplier" };

  if (delivery.purchaseOrder.warehouseId && delivery.purchaseOrder.warehouseId !== warehouseId) {
    return {
      error: "Pengiriman ini ditujukan untuk plant/gudang yang berbeda dan tidak dapat diproses oleh akun Anda",
    };
  }

  const pendingExists = delivery.receivings.some((r) => r.status === "PENDING");
  if (pendingExists) return { error: "Sudah ada receiving pending untuk delivery ini" };

  const detailsRaw = String(formData.get("details") ?? "[]");
  let details: { deliveryDetailId: string; itemId: string; qtyOrdered: number; qtyDelivered: number; qtyReceived: number; receivedPackageQty?: number }[];
  try {
    details = JSON.parse(detailsRaw);
  } catch {
    return { error: "Data item tidak valid" };
  }

  if (!details.length) return { error: "Minimal satu item diisi" };

  // BR-005: receiving tidak boleh melebihi outstanding qty PO
  const detailMap = new Map(delivery.details.map((d) => [d.id, d]));
  for (const d of details) {
    const dd = detailMap.get(d.deliveryDetailId);
    if (!dd) return { error: "Item delivery tidak valid" };
    if (d.qtyReceived > d.qtyDelivered) {
      return { error: `Qty receiving melebihi qty delivery untuk item` };
    }
    const poDetail = dd.purchaseOrderDetail;
    const outstanding = poDetail.qty - poDetail.receivedQty;
    if (d.qtyReceived > outstanding) {
      return { error: `Qty receiving melebihi outstanding PO (maks ${outstanding})` };
    }
  }

  const receivingNumber = await nextNumber("receiving");

  await prisma.$transaction(async (tx) => {
    const receiving = await tx.receiving.create({
      data: {
        receivingNumber,
        deliveryId: delivery.id,
        purchaseOrderId: delivery.purchaseOrderId,
        warehouseId,
        receivedById: user.id,
        status: "RECEIVED",
        isManual: false,
        details: {
          create: details.map((d) => ({
            deliveryDetailId: d.deliveryDetailId,
            itemId: d.itemId,
            qtyOrdered: d.qtyOrdered,
            qtyDelivered: d.qtyDelivered,
            qtyReceived: d.qtyReceived,
          })),
        },
      },
    });

    // update receivedQty and receivedPackageQty on PO detail
    for (const d of details) {
      const dd = detailMap.get(d.deliveryDetailId)!;
      const pkgQty = d.receivedPackageQty ?? 0;
      await tx.purchaseOrderDetail.update({
        where: { id: dd.purchaseOrderDetailId },
        data: {
          receivedQty: { increment: d.qtyReceived },
          receivedPackageQty: { increment: pkgQty },
        },
      });
    }

    // update delivery status
    await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: "ARRIVED" },
    });

    // update PO status otomatis (BR-008, BR-009)
    const poDetails = await tx.purchaseOrderDetail.findMany({
      where: { purchaseOrderId: delivery.purchaseOrderId },
    });
    const allReceived = poDetails.every((d) => d.receivedQty >= d.qty);
    const anyReceived = poDetails.some((d) => d.receivedQty > 0);
    await tx.purchaseOrder.update({
      where: { id: delivery.purchaseOrderId },
      data: {
        status: allReceived ? "CLOSED" : anyReceived ? "PARTIALLY_RECEIVED" : "WAITING_RECEIVING",
      },
    });

    return receiving.id;
  });

  await writeAuditLog(
    user,
    "CONFIRM_RECEIVING",
    "Delivery",
    delivery.id,
    `Receiving ${receivingNumber} untuk ${delivery.deliveryNumber}`,
  );
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/receivings");
  revalidatePath("/warehouse/scan");
  return { redirect: "/warehouse/receivings?success=1" };
}
