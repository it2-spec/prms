import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { PageTitle } from "@/components/ui";
import ReviseForm, { ItemOption, WarehouseOption, DetailRow } from "./ReviseForm";

export const dynamic = "force-dynamic";

const DEFAULT_DEPTS = [
  "Painting Plant 1",
  "Painting Plant 2",
  "Injection Moulding",
  "Assembly",
  "Production Preparation",
  "Quality Control / QA",
  "Maintenance / Engineering",
  "Warehouse & Logistic",
  "Production Planning & Inventory Control",
  "Purchasing",
  "General Affair & HR",
];

async function revisePo(
  poId: string,
  formData: FormData,
): Promise<{ error?: string; redirect?: string }> {
  "use server";
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") return { error: "Unauthorized" };

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      details: { include: { item: true } },
      warehouse: true,
      receivings: { include: { details: true } },
    },
  });

  if (!po) return { error: "PO tidak ditemukan" };
  if (["CLOSED", "CANCELLED"].includes(po.status)) {
    return { error: `PO berstatus ${po.status} tidak dapat direvisi` };
  }

  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const expectedDeliveryRaw = String(formData.get("expectedDelivery") ?? "").trim();
  const deliveryDateType = String(formData.get("deliveryDateType") ?? "DATE").trim().toUpperCase();
  const department = String(formData.get("department") ?? "").trim();
  const purposeProject = String(formData.get("purposeProject") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const revisionReason = String(formData.get("revisionReason") ?? "").trim();
  const detailsRaw = String(formData.get("details") ?? "[]");

  if (!revisionReason) {
    return { error: "Alasan revisi PO wajib diisi!" };
  }

  let details: { id?: string; itemId: string; qty: number; unitPrice: number }[];
  try {
    details = JSON.parse(detailsRaw);
  } catch {
    return { error: "Data item tidak valid" };
  }

  if (!details.length) return { error: "Minimal satu item harus ada di PO" };

  // Calculate received quantities per item
  const receivedByItem = new Map<string, number>();
  for (const rec of po.receivings) {
    for (const rd of rec.details) {
      receivedByItem.set(rd.itemId, (receivedByItem.get(rd.itemId) || 0) + rd.qtyReceived);
    }
  }

  // Check received quantity constraints
  for (const d of details) {
    const rcv = receivedByItem.get(d.itemId) || 0;
    const oldDetail = po.details.find((x) => x.itemId === d.itemId || x.id === d.id);
    const originalQty = oldDetail ? Number(oldDetail.qty) : 0;
    // Hanya tolak jika kuantitas sengaja diturunkan di bawah barang yang sudah diterima gudang
    if (rcv > 0 && d.qty < rcv && d.qty < originalQty) {
      const it = po.details.find((x) => x.itemId === d.itemId)?.item;
      return {
        error: `Kuantitas item "${it?.name || "Item"}" tidak boleh diturunkan kurang dari jumlah yang sudah diterima gudang (${rcv}).`,
      };
    }
  }

  // Parse expected delivery
  let expectedDeliveryDateStr = expectedDeliveryRaw;
  if (expectedDeliveryDateStr && /^\d{4}-\d{2}$/.test(expectedDeliveryDateStr)) {
    expectedDeliveryDateStr += "-01";
  }
  const expectedDelivery = expectedDeliveryDateStr ? new Date(expectedDeliveryDateStr) : null;

  const oldSnapshot = po.details.map((d) => ({
    id: d.id,
    itemId: d.itemId,
    itemName: d.item?.name || "Item",
    itemCode: d.item?.code || "",
    unit: d.item?.unit || "kg",
    qty: d.qty,
    unitPrice: Number(d.unitPrice),
  }));

  const detailsWithId = details.map((d) => ({
    ...d,
    id:
      d.id ??
      oldSnapshot.find((o) => o.itemId === d.itemId)?.id ??
      undefined,
  }));

  const toUpdate = detailsWithId.filter((d) => d.id && oldSnapshot.some((o) => o.id === d.id));
  const toCreate = detailsWithId.filter((d) => !d.id);
  const existingIds = new Set(detailsWithId.map((d) => d.id).filter(Boolean));
  const toDelete = po.details.filter((d) => !existingIds.has(d.id));

  // Check if any deleted item has received quantities
  for (const d of toDelete) {
    const rcv = receivedByItem.get(d.itemId) || 0;
    if (rcv > 0) {
      return { error: `Item yang sudah pernah diterima (${rcv}) tidak dapat dihapus dari PO` };
    }
  }

  // Fetch items for newly added details for proper logging
  const newlyCreatedItemIds = toCreate.map((d) => d.itemId);
  const newItemsInfo = newlyCreatedItemIds.length > 0
    ? await prisma.item.findMany({
        where: { id: { in: newlyCreatedItemIds } },
        select: { id: true, code: true, name: true, unit: true },
      })
    : [];
  const newItemMap = new Map(newItemsInfo.map((it) => [it.id, it]));

  // Generate revision diff logs (categories, itemChanges, qtyChanges, priceChanges, metaChanges)
  const itemChanges: string[] = [];
  const qtyChanges: string[] = [];
  const priceChanges: string[] = [];
  const metaChanges: string[] = [];
  const categories: string[] = [];

  // 1. Deleted items
  for (const d of toDelete) {
    itemChanges.push(`Hapus item: [${d.item?.code}] ${d.item?.name} (Qty semula: ${d.qty} ${d.item?.unit || "kg"})`);
  }

  // 2. Added items
  for (const d of toCreate) {
    const it = newItemMap.get(d.itemId);
    itemChanges.push(`Tambah item baru: [${it?.code || d.itemId}] ${it?.name || "Item"} (Qty: ${d.qty} ${it?.unit || "kg"} @ Rp ${d.unitPrice.toLocaleString("id-ID")})`);
  }

  // 3. Updated items (Qty & Price)
  for (const d of toUpdate) {
    const old = oldSnapshot.find((o) => o.id === d.id);
    if (old) {
      if (old.qty !== d.qty) {
        const diff = d.qty - old.qty;
        const diffSign = diff > 0 ? `+${diff}` : `${diff}`;
        qtyChanges.push(`[${old.itemCode}] ${old.itemName}: Qty diubah dari ${old.qty} menjadi ${d.qty} ${old.unit} (${diffSign} ${old.unit})`);
      }
      if (old.unitPrice !== d.unitPrice) {
        priceChanges.push(`[${old.itemCode}] ${old.itemName}: Harga diubah dari Rp ${old.unitPrice.toLocaleString("id-ID")} menjadi Rp ${d.unitPrice.toLocaleString("id-ID")}`);
      }
    }
  }

  // 4. Metadata diffs
  if (warehouseId && warehouseId !== po.warehouseId) {
    const newWh = await prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { name: true } });
    metaChanges.push(`Gudang tujuan diubah dari "${po.warehouse?.name ?? "-"}" menjadi "${newWh?.name ?? warehouseId}"`);
  }

  const oldExpStr = po.expectedDelivery ? po.expectedDelivery.toISOString().slice(0, 10) : "";
  const newExpStr = expectedDelivery ? expectedDelivery.toISOString().slice(0, 10) : "";
  if (oldExpStr !== newExpStr) {
    metaChanges.push(`Estimasi tanggal kirim diubah dari "${oldExpStr || "-"}" menjadi "${newExpStr || "-"}"`);
  }

  if ((po.department || "") !== (department || "")) {
    metaChanges.push(`Departemen pemohon diubah dari "${po.department || "-"}" menjadi "${department || "-"}"`);
  }

  if ((po.purposeProject || "") !== (purposeProject || "")) {
    metaChanges.push(`Purpose / Project diubah`);
  }

  if ((po.notes || "") !== (notes || "")) {
    metaChanges.push(`Quotation / Catatan PO diperbarui`);
  }

  // Determine category tags
  if (itemChanges.length > 0) categories.push("Revisi Item");
  if (qtyChanges.length > 0) categories.push("Revisi Qty");
  if (priceChanges.length > 0) categories.push("Revisi Harga");
  if (metaChanges.length > 0) categories.push("Revisi Data PO");
  if (categories.length === 0) categories.push("Pembaruan Minor");

  const newRevisionNumber = po.revisionCount + 1;
  const revisionTag = `REV ${String(newRevisionNumber).padStart(2, "0")}`;

  const structuredLog = {
    revisionTag,
    revisionNumber: newRevisionNumber,
    reason: revisionReason,
    categories,
    itemChanges,
    qtyChanges,
    priceChanges,
    metaChanges,
    revisedBy: user.name,
    createdAt: new Date().toISOString(),
  };

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete removed details
      for (const d of toDelete) {
        await tx.purchaseOrderDetail.delete({ where: { id: d.id } });
      }

      // 2. Update existing details with recalculated packageQty
      for (const d of toUpdate) {
        const itm = await tx.item.findUnique({ where: { id: d.itemId } });
        const pkgSize = Number(itm?.packageSize ?? 1);
        const packageQty = pkgSize > 0 ? Math.ceil(d.qty / pkgSize) : d.qty;
        await tx.purchaseOrderDetail.update({
          where: { id: d.id! },
          data: {
            itemId: d.itemId,
            qty: d.qty,
            unitPrice: d.unitPrice,
            packageQty,
            packageUnit: itm?.packageUnit || "pail",
            unit: itm?.unit || "kg",
          },
        });
      }

      // 3. Create new details with packageQty
      for (const d of toCreate) {
        const itm = await tx.item.findUnique({ where: { id: d.itemId } });
        const pkgSize = Number(itm?.packageSize ?? 1);
        const packageQty = pkgSize > 0 ? Math.ceil(d.qty / pkgSize) : d.qty;
        await tx.purchaseOrderDetail.create({
          data: {
            purchaseOrderId: po.id,
            itemId: d.itemId,
            qty: d.qty,
            unitPrice: d.unitPrice,
            packageQty,
            packageUnit: itm?.packageUnit || "pail",
            unit: itm?.unit || "kg",
          },
        });
      }

      // 4. Update PO metadata, bump revision, and RESET APPROVALS
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          warehouseId: warehouseId || po.warehouseId,
          expectedDelivery,
          deliveryDateType: deliveryDateType === "MONTH" ? "MONTH" : "DATE",
          department: department || null,
          purposeProject: purposeProject || null,
          notes: notes || null,
          status: "REVISED",
          revisionCount: { increment: 1 },
          // Reset persetujuan berjenjang karena konten PO telah direvisi
          approvedById: null,
          approvedAt: null,
          approvedL2ById: null,
          approvedL2At: null,
          verificationHash: null,
        },
      });
    });

    // Write structured JSON log to AuditLog
    await writeAuditLog(
      user,
      "REVISE_PO",
      "PurchaseOrder",
      po.id,
      JSON.stringify(structuredLog),
    );

    revalidatePath(`/purchasing/purchase-orders/${po.id}`);
    revalidatePath(`/purchasing/purchase-orders/${po.id}/print`);
    revalidatePath(`/supplier/purchase-orders/${po.id}`);
    revalidatePath("/purchasing/purchase-orders");
    revalidatePath("/purchasing");
    revalidatePath("/supplier/purchase-orders");
    return { redirect: `/purchasing/purchase-orders/${po.id}` };
  } catch (err: any) {
    console.error("Error revising PO:", err);
    return { error: err.message || "Gagal menyimpan revisi PO" };
  }
}

export default async function RevisePoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  // Manager L1 & Presdir L2 tidak merevisi PO (hanya approve/batal)
  if (user.approvalLevel === 1 || user.approvalLevel === 2) {
    redirect(`/purchasing/purchase-orders/${id}`);
  }

  const [po, items, warehouses, rawDepts, revisionAuditLogs] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        details: { include: { item: true } },
        supplier: true,
        warehouse: true,
        receivings: { include: { details: true } },
      },
    }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        packageUnit: true,
        packageSize: true,
        lastUnitPrice: true,
      },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    (async () => {
      try {
        if ((prisma as any).dept?.findMany) {
          return await (prisma as any).dept.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, code: true, name: true },
          });
        }
        return await prisma.$queryRaw<{ id: string; code: string; name: string }[]>`
          SELECT id, code, name FROM "Dept" WHERE "isActive" = true ORDER BY name ASC
        `;
      } catch {
        return DEFAULT_DEPTS.map((d) => ({ id: d, code: d, name: d }));
      }
    })(),
    prisma.auditLog.findMany({
      where: {
        entityType: "PurchaseOrder",
        entityId: id,
        action: "REVISE_PO",
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!po) notFound();

  // If PO is closed or cancelled, redirect
  if (["CLOSED", "CANCELLED"].includes(po.status)) {
    redirect(`/purchasing/purchase-orders/${po.id}`);
  }

  // Calculate received quantities per item
  const receivedByItem = new Map<string, number>();
  for (const rec of po.receivings) {
    for (const rd of rec.details) {
      receivedByItem.set(rd.itemId, (receivedByItem.get(rd.itemId) || 0) + rd.qtyReceived);
    }
  }

  const initialDetails: DetailRow[] = po.details.map((d) => {
    const pkgSize = Number(d.item?.packageSize ?? 1);
    const baseQty = d.qty;
    const pkgQty = pkgSize > 0 ? Math.round((baseQty / pkgSize) * 100) / 100 : baseQty;

    return {
      id: d.id,
      itemId: d.itemId,
      qty: baseQty,
      packageQty: pkgQty,
      unitPrice: Number(d.unitPrice),
      receivedQty: receivedByItem.get(d.itemId) || 0,
    };
  });

  // Format expected delivery string
  let initialExpectedDelivery = "";
  if (po.expectedDelivery) {
    const d = new Date(po.expectedDelivery);
    if (!isNaN(d.getTime())) {
      if (po.deliveryDateType === "MONTH") {
        initialExpectedDelivery = d.toISOString().slice(0, 7); // YYYY-MM
      } else {
        initialExpectedDelivery = d.toISOString().slice(0, 10); // YYYY-MM-DD
      }
    }
  }

  const deptOptions = (rawDepts && rawDepts.length > 0)
    ? rawDepts.map((d: any) => ({ id: d.name, name: d.name, code: d.code }))
    : DEFAULT_DEPTS.map((name) => ({ id: name, name, code: name }));

  const previousRevisions = revisionAuditLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userName: log.user?.name || "Purchasing",
    action: log.action,
    detail: log.detail,
  }));

  const nextRevisionTag = `REV ${String(po.revisionCount + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <PageTitle
        title={`Revisi PO: ${po.poNumber}`}
        subtitle={`Nomor Dokumen Revisi: ${po.poNumber} ${nextRevisionTag} · Supplier: ${po.supplier.name} · Dibuat ${new Date(po.poDate).toLocaleDateString("id-ID")}`}
        breadcrumb={["Purchase Orders", po.poNumber, `Revisi (${nextRevisionTag})`]}
      />

      <ReviseForm
        poId={po.id}
        poNumber={po.poNumber}
        poDate={new Date(po.poDate).toISOString()}
        revisionCount={po.revisionCount}
        supplier={{
          id: po.supplier.id,
          code: po.supplier.code,
          name: po.supplier.name,
          address: po.supplier.address,
          phone: po.supplier.phone,
          contactPerson: po.supplier.contactPerson,
        }}
        initialWarehouseId={po.warehouseId || ""}
        initialExpectedDelivery={initialExpectedDelivery}
        initialDeliveryDateType={(po.deliveryDateType as "DATE" | "MONTH") || "DATE"}
        initialDepartment={po.department || ""}
        initialPurposeProject={po.purposeProject || ""}
        initialNotes={po.notes || ""}
        deptOptions={deptOptions}
        warehouses={warehouses}
        items={items.map((i) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          unit: i.unit,
          packageUnit: i.packageUnit,
          packageSize: i.packageSize ? Number(i.packageSize) : null,
          lastUnitPrice: Number(i.lastUnitPrice || 0),
        }))}
        initialDetails={initialDetails}
        previousRevisions={previousRevisions}
        revisePo={revisePo}
      />
    </div>
  );
}
