import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextNumber, writeAuditLog } from "@/lib/utils";
import { Card, PageTitle } from "@/components/ui";
import DeliveryForm from "./DeliveryForm";

export const dynamic = "force-dynamic";

async function createDelivery(
  formData: FormData,
): Promise<{ error?: string; redirect?: string }> {
  "use server";
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) {
    return { error: "Unauthorized" };
  }

  const poId = String(formData.get("poId") ?? "");
  const suratJalan = String(formData.get("suratJalan") ?? "").trim();
  const shipDateRaw = String(formData.get("shipDate") ?? "");
  const detailsRaw = String(formData.get("details") ?? "[]");

  if (!poId) return { error: "PO wajib dipilih" };
  if (!suratJalan) return { error: "Nomor Surat Jalan wajib diisi" };
  if (!shipDateRaw) return { error: "Tanggal kirim wajib diisi" };

  let details: { purchaseOrderDetailId: string; itemId: string; qty: number }[];
  try {
    details = JSON.parse(detailsRaw);
  } catch {
    return { error: "Data item tidak valid" };
  }

  if (!details.length) return { error: "Minimal satu item" };
  const totalQty = details.reduce((s, d) => s + (d.qty || 0), 0);
  if (totalQty <= 0) return { error: "Qty pengiriman harus lebih dari 0" };

  // BR-003: satu delivery hanya untuk satu PO
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { details: { include: { item: true } } },
  });
  if (!po) return { error: "PO tidak ditemukan" };
  // BR-001: supplier hanya bisa melihat PO miliknya
  if (po.supplierId !== dbUser.supplierId) return { error: "PO bukan milik Anda" };
  if (!["WAITING_DELIVERY", "PARTIALLY_DELIVERED", "SENT", "PARTIALLY_RECEIVED"].includes(po.status)) {
    return { error: "PO tidak dapat dikirim (status bukan Waiting Delivery)" };
  }

  const detailMap = new Map(po.details.map((d) => [d.id, d]));
  for (const d of details) {
    const pod = detailMap.get(d.purchaseOrderDetailId);
    if (!pod) return { error: "Item tidak valid" };

    const pkgSize = Number(pod.item?.packageSize ?? 1);
    // d.qty sent from client is package count (e.g. 2 Pail)
    const pkgQty = Math.floor(d.qty);
    const kgQty = pkgQty * pkgSize;

    const outstandingKg = pod.qty - pod.deliveredQty;
    if (kgQty > outstandingKg) {
      return { error: `Pengiriman (${pkgQty} ${pod.item?.packageUnit || "kemasan"}) melebihi sisa PO` };
    }
  }

  const deliveryNumber = await nextNumber("delivery");

  const deliveryId = await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.create({
      data: {
        deliveryNumber,
        purchaseOrderId: po.id,
        supplierId: dbUser.supplierId!,
        suratJalan,
        shipDate: new Date(shipDateRaw),
        status: "CREATED",
        createdById: user.id,
        details: {
          create: details.map((d) => {
            const pod = detailMap.get(d.purchaseOrderDetailId)!;
            const pkgSize = Number(pod.item?.packageSize ?? 1);
            const pkgQty = Math.floor(d.qty);
            const kgQty = pkgQty * pkgSize;
            return {
              purchaseOrderDetailId: d.purchaseOrderDetailId,
              itemId: d.itemId,
              qty: kgQty,
              unitPrice: pod.unitPrice,
            };
          }),
        },
      },
    });

    // update deliveredQty & PO status
    for (const d of details) {
      const pod = detailMap.get(d.purchaseOrderDetailId)!;
      const pkgSize = Number(pod.item?.packageSize ?? 1);
      const pkgQty = Math.floor(d.qty);
      const kgQty = pkgQty * pkgSize;

      await tx.purchaseOrderDetail.update({
        where: { id: d.purchaseOrderDetailId },
        data: { deliveredQty: { increment: kgQty } },
      });
    }

    const allDelivered = await tx.purchaseOrderDetail.findMany({ where: { purchaseOrderId: po.id } });
    const fullyDelivered = allDelivered.every((d) => d.deliveredQty >= d.qty);
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: fullyDelivered ? "WAITING_RECEIVING" : "PARTIALLY_DELIVERED" },
    });

    return delivery.id;
  });

  await writeAuditLog(user, "CREATE_DELIVERY", "Delivery", deliveryNumber, `Delivery ${deliveryNumber} untuk PO ${po.poNumber}`);
  revalidatePath("/supplier");
  revalidatePath("/supplier/deliveries");
  revalidatePath(`/purchasing/purchase-orders/${po.id}`);
  return { redirect: `/supplier/deliveries/${deliveryId}/qr` };
}

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ po?: string }>;
}) {
  const params = await searchParams;
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) redirect("/login");

  const selectablePOs = await prisma.purchaseOrder.findMany({
    where: {
      supplierId: dbUser.supplierId,
      status: { in: ["WAITING_DELIVERY", "PARTIALLY_DELIVERED", "SENT", "PARTIALLY_RECEIVED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { details: { include: { item: true } } },
  });

  const po = params.po
    ? await prisma.purchaseOrder.findUnique({
        where: { id: params.po },
        include: { details: { include: { item: true } } },
      })
    : null;

  const validPO = po && po.supplierId === dbUser.supplierId ? po : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle
        title="Buat Delivery"
        subtitle="Buat surat jalan digital dan generate QR Code untuk pengiriman"
        breadcrumb={["Deliveries", "Buat Delivery"]}
      />
      <Card>
        <DeliveryForm
          selectablePOs={selectablePOs
            .map((p) => ({
              id: p.id,
              poNumber: p.poNumber,
              details: p.details
                .filter((d) => Math.max(0, d.qty - d.deliveredQty) > 0)
                .map((d) => {
                  const pkgSize = Number(d.item.packageSize ?? 1);
                  const outstandingKg = Math.max(0, d.qty - d.deliveredQty);
                  const pkgOutstanding = pkgSize > 0 ? Math.floor(outstandingKg / pkgSize) : outstandingKg;
                  return {
                    id: d.id,
                    itemId: d.itemId,
                    itemCode: d.item.code,
                    itemName: d.item.name,
                    unit: d.item.unit,
                    packageUnit: d.item.packageUnit,
                    packageSize: pkgSize,
                    qty: d.qty,
                    deliveredQty: d.deliveredQty,
                    outstanding: outstandingKg,
                    pkgOutstanding: pkgOutstanding,
                  };
                }),
            }))
            // only show POs that still have at least one item with outstanding pkg > 0
            .filter((p) => p.details.some((d) => d.pkgOutstanding > 0))
          }
          initialPO={validPO ? {
            id: validPO.id,
            poNumber: validPO.poNumber,
            details: validPO.details
              .filter((d) => Math.max(0, d.qty - d.deliveredQty) > 0)
              .map((d) => {
                const pkgSize = Number(d.item.packageSize ?? 1);
                const outstandingKg = Math.max(0, d.qty - d.deliveredQty);
                const pkgOutstanding = pkgSize > 0 ? Math.floor(outstandingKg / pkgSize) : outstandingKg;
                return {
                  id: d.id,
                  itemId: d.itemId,
                  itemCode: d.item.code,
                  itemName: d.item.name,
                  unit: d.item.unit,
                  packageUnit: d.item.packageUnit,
                  packageSize: pkgSize,
                  qty: d.qty,
                  deliveredQty: d.deliveredQty,
                  outstanding: outstandingKg,
                  pkgOutstanding: pkgOutstanding,
                };
              }),
          } : null}
          createDelivery={createDelivery}
        />
      </Card>
    </div>
  );
}
