import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextNumber, writeAuditLog } from "@/lib/utils";
import { Card, PageTitle } from "@/components/ui";
import ManualReceivingForm from "./ManualReceivingForm";

export const dynamic = "force-dynamic";

async function createManualReceiving(
  formData: FormData,
): Promise<{ error?: string; redirect?: string }> {
  "use server";
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") return { error: "Unauthorized" };
  if (!dbUser?.warehouseId) return { error: "Anda tidak terhubung ke warehouse manapun" };

  const poId = String(formData.get("poId") ?? "");
  const suratJalan = String(formData.get("suratJalan") ?? "").trim();
  const shipDateRaw = String(formData.get("shipDate") ?? "");
  const detailsRaw = String(formData.get("details") ?? "[]");

  if (!poId) return { error: "PO wajib dipilih" };
  if (!suratJalan) return { error: "Nomor Surat Jalan wajib diisi" };
  if (!shipDateRaw) return { error: "Tanggal kirim wajib diisi" };

  let details: { itemId: string; qtyOrdered: number; qtyReceived: number }[];
  try {
    details = JSON.parse(detailsRaw);
  } catch {
    return { error: "Data item tidak valid" };
  }
  if (!details.length) return { error: "Minimal satu item" };

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { details: { include: { item: true } } },
  });
  if (!po) return { error: "PO tidak ditemukan" };
  if (po.warehouseId && po.warehouseId !== dbUser.warehouseId) {
    return { error: "PO ini ditujukan untuk plant/gudang yang berbeda dan tidak dapat diproses oleh akun Anda" };
  }

  const poDetailMap = new Map(po.details.map((d) => [d.itemId, d]));
  for (const d of details) {
    const pod = poDetailMap.get(d.itemId);
    if (!pod) return { error: "Item tidak sesuai PO" };

    const pkgSize = Number(pod.item?.packageSize ?? 1);
    const pkgQty = Math.floor(d.qtyReceived);
    const kgReceived = pkgQty * pkgSize;

    if (pkgQty <= 0) return { error: "Jumlah kemasan receiving harus minimal 1" };
    const outstandingKg = pod.qty - pod.receivedQty;
    if (kgReceived > outstandingKg) {
      return { error: `Receiving (${pkgQty} ${pod.item?.packageUnit || "kemasan"}) melebihi sisa PO` };
    }
  }

  const deliveryNumber = await nextNumber("delivery");
  const receivingNumber = await nextNumber("receiving");

  await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.create({
      data: {
        deliveryNumber,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        suratJalan,
        shipDate: new Date(shipDateRaw),
        status: "ARRIVED",
        createdById: user.id,
        details: {
          create: details.map((d) => {
            const pod = poDetailMap.get(d.itemId)!;
            const pkgSize = Number(pod.item?.packageSize ?? 1);
            const pkgQty = Math.floor(d.qtyReceived);
            const kgReceived = pkgQty * pkgSize;
            return {
              purchaseOrderDetailId: pod.id,
              itemId: d.itemId,
              qty: kgReceived,
              unitPrice: pod.unitPrice,
            };
          }),
        },
      },
    });

    const receiving = await tx.receiving.create({
      data: {
        receivingNumber,
        deliveryId: delivery.id,
        purchaseOrderId: po.id,
        warehouseId: dbUser.warehouseId!,
        receivedById: user.id,
        status: "RECEIVED",
        isManual: true,
        details: {
          create: details.map((d) => {
            const pod = poDetailMap.get(d.itemId)!;
            const pkgSize = Number(pod.item?.packageSize ?? 1);
            const pkgQty = Math.floor(d.qtyReceived);
            const kgReceived = pkgQty * pkgSize;
            return {
              itemId: d.itemId,
              qtyOrdered: pod.qty,
              qtyDelivered: kgReceived,
              qtyReceived: kgReceived,
            };
          }),
        },
      },
    });

    for (const d of details) {
      const pod = poDetailMap.get(d.itemId)!;
      const pkgSize = Number(pod.item?.packageSize ?? 1);
      const pkgQty = Math.floor(d.qtyReceived);
      const kgReceived = pkgQty * pkgSize;

      await tx.purchaseOrderDetail.update({
        where: { id: pod.id },
        data: {
          deliveredQty: { increment: kgReceived },
          receivedQty: { increment: kgReceived },
          receivedPackageQty: { increment: pkgQty },
        },
      });
    }

    const poDetails = await tx.purchaseOrderDetail.findMany({ where: { purchaseOrderId: po.id } });
    const allReceived = poDetails.every((d) => d.receivedQty >= d.qty);
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: allReceived ? "CLOSED" : "PARTIALLY_RECEIVED" },
    });

    return receiving.id;
  });

  await writeAuditLog(
    user,
    "MANUAL_RECEIVING",
    "PurchaseOrder",
    po.id,
    `Manual receiving ${receivingNumber} (QR rusak)`,
  );
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/receivings");
  return { redirect: "/warehouse/receivings?success=1" };
}

export default async function ManualInputPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  const whereClause: any = {
    status: { not: "CLOSED" },
    ...(dbUser?.warehouseId ? { warehouseId: dbUser.warehouseId } : {}),
  };

  const pos = await prisma.purchaseOrder.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: { supplier: true, details: { include: { item: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle
        title="Manual Input Receiving"
        subtitle="Digunakan saat QR rusak atau tidak terbaca (BR-007)"
        breadcrumb={["Receiving", "Manual Input"]}
      />
      <Card>
        <ManualReceivingForm
          pos={pos.map((p) => ({
            id: p.id,
            poNumber: p.poNumber,
            supplierName: p.supplier.name,
            details: p.details.map((d) => {
              const pkgSize = Number(d.item.packageSize ?? 1);
              const outstandingKg = Math.max(0, d.qty - d.receivedQty);
              const pkgOutstanding = pkgSize > 0 ? Math.floor(outstandingKg / pkgSize) : outstandingKg;
              return {
                itemId: d.itemId,
                itemCode: d.item.code,
                itemName: d.item.name,
                unit: d.item.unit,
                packageUnit: d.item.packageUnit,
                packageSize: pkgSize,
                qty: d.qty,
                receivedQty: d.receivedQty,
                outstanding: outstandingKg,
                pkgOutstanding: pkgOutstanding,
              };
            }),
          }))}
          createManualReceiving={createManualReceiving}
        />
      </Card>
    </div>
  );
}
