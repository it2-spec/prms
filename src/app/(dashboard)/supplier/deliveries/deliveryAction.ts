"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

export async function cancelDelivery(
  deliveryId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user, dbUser } = await getSessionUser();
    if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) {
      return { error: "Unauthorized: Hanya supplier yang dapat membatalkan delivery." };
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        details: true,
        receivings: true,
        purchaseOrder: {
          include: {
            details: true,
          },
        },
      },
    });

    if (!delivery) {
      return { error: "Delivery tidak ditemukan." };
    }

    if (delivery.supplierId !== dbUser.supplierId) {
      return { error: "Anda tidak berhak membatalkan surat jalan milik supplier lain." };
    }

    if (delivery.status === "CANCELLED") {
      return { error: "Surat jalan ini sudah dibatalkan sebelumnya." };
    }

    // Hanya bisa dibatalkan jika statusnya baru dibuat (CREATED) dan belum pernah diterima (receivings kosong)
    if (delivery.status !== "CREATED" || delivery.receivings.length > 0) {
      return {
        error:
          "Surat jalan tidak dapat dibatalkan karena sudah dalam proses penerimaan atau telah diterima oleh gudang.",
      };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Ubah status delivery menjadi CANCELLED
      await tx.delivery.update({
        where: { id: delivery.id },
        data: { status: "CANCELLED" },
      });

      // 2. Kembalikan (kurangi) deliveredQty pada setiap PurchaseOrderDetail
      for (const item of delivery.details) {
        const currentDetail = await tx.purchaseOrderDetail.findUnique({
          where: { id: item.purchaseOrderDetailId },
        });

        if (currentDetail) {
          const newDeliveredQty = Math.max(0, currentDetail.deliveredQty - item.qty);
          await tx.purchaseOrderDetail.update({
            where: { id: item.purchaseOrderDetailId },
            data: { deliveredQty: newDeliveredQty },
          });
        }
      }

      // 3. Rekalkulasi status Purchase Order
      const allPoDetails = await tx.purchaseOrderDetail.findMany({
        where: { purchaseOrderId: delivery.purchaseOrderId },
      });

      const anyReceived = allPoDetails.some((d) => d.receivedQty > 0);
      const allReceived =
        allPoDetails.length > 0 && allPoDetails.every((d) => d.receivedQty >= d.qty);
      const anyDelivered = allPoDetails.some((d) => d.deliveredQty > 0);
      const allDelivered =
        allPoDetails.length > 0 && allPoDetails.every((d) => d.deliveredQty >= d.qty);

      let nextPoStatus:
        | "CLOSED"
        | "PARTIALLY_RECEIVED"
        | "WAITING_RECEIVING"
        | "PARTIALLY_DELIVERED"
        | "WAITING_DELIVERY";

      if (allReceived) {
        nextPoStatus = "CLOSED";
      } else if (anyReceived) {
        nextPoStatus = "PARTIALLY_RECEIVED";
      } else if (allDelivered) {
        nextPoStatus = "WAITING_RECEIVING";
      } else if (anyDelivered) {
        nextPoStatus = "PARTIALLY_DELIVERED";
      } else {
        nextPoStatus = "WAITING_DELIVERY";
      }

      await tx.purchaseOrder.update({
        where: { id: delivery.purchaseOrderId },
        data: { status: nextPoStatus },
      });
    });

    await writeAuditLog(
      user,
      "CANCEL_DELIVERY",
      "Delivery",
      delivery.deliveryNumber,
      `Delivery ${delivery.deliveryNumber} (Surat Jalan: ${delivery.suratJalan}) dibatalkan oleh supplier. Qty PO dikembalikan.`,
    );

    revalidatePath("/supplier");
    revalidatePath("/supplier/deliveries");
    revalidatePath(`/supplier/deliveries/${delivery.id}/qr`);
    revalidatePath(`/purchasing/purchase-orders/${delivery.purchaseOrderId}`);
    revalidatePath("/purchasing/deliveries");
    revalidatePath(`/purchasing/deliveries/${delivery.id}`);

    return { success: true };
  } catch (err: any) {
    console.error("Error cancelling delivery:", err);
    return { error: err?.message || "Gagal membatalkan delivery." };
  }
}
