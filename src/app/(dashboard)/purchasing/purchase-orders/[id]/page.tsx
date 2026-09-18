import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, Button, PageTitle } from "@/components/ui";
import { PO_STATUS_LABEL, formatDateOnly, formatMoney, writeAuditLog } from "@/lib/utils";
import { notifyPoApprovedL1, notifyPoApprovedL2, notifyPoSentToSupplier, notifyPoCancelledToSupplier } from "@/lib/notifications";
import { Printer, ShieldCheck, History, User, FileText, GitCommit, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import PoDeliveryReceivingView from "@/components/purchasing/PoDeliveryReceivingView";
import SendPoButton from "@/components/purchasing/SendPoButton";
import DeletePoButton from "./DeletePoButton";
import CancelPoButton from "./CancelPoButton";
import crypto from "crypto";

export const dynamic = "force-dynamic";

async function sendPo(poId: string) {
  "use server";
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") return { error: "Unauthorized" };
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po || !["DRAFT", "REVISED"].includes(po.status)) return { error: "Status PO tidak valid untuk dikirim" };
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "WAITING_DELIVERY" },
  });
  await writeAuditLog(user, "SEND_PO", "PurchaseOrder", poId, `PO ${po.poNumber} dikirim ke supplier`);
  await notifyPoSentToSupplier({
    poId: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
  });
  revalidatePath(`/purchasing/purchase-orders/${poId}`);
  return { success: true };
}

// L1 Approval: Manager Purchasing
async function approvePoL1(poId: string) {
  "use server";
  const { user } = await getSessionUser();
  if (!user || user.approvalLevel !== 1) return;
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po || po.approvedById || po.status === "CANCELLED") return; // Sudah di-approve L1 atau batal
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { approvedById: user.id, approvedAt: new Date() },
  });
  await writeAuditLog(user, "APPROVE_PO_L1", "PurchaseOrder", poId, `PO ${po.poNumber} disetujui Manager: ${user.name}`);
  await notifyPoApprovedL1({
    poId: po.id,
    poNumber: po.poNumber,
    approverName: user.name,
  });
  revalidatePath(`/purchasing/purchase-orders/${poId}`);
}

// L2 Approval: Presdir — hanya bisa setelah L1 selesai
async function approvePoL2(poId: string) {
  "use server";
  const { user } = await getSessionUser();
  if (!user || user.approvalLevel !== 2) return;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { details: true },
  });
  if (!po || !po.approvedById || po.status === "CANCELLED") return; // L1 belum selesai atau batal
  if (po.approvedL2ById) return; // Sudah di-approve L2

  const totalValue = po.details.reduce((s, d) => s + d.qty * Number(d.unitPrice), 0);
  // Hash dibuat saat L2 (approval final)
  const hashPayload = [po.id, po.poNumber, po.supplierId, po.createdById, po.poDate.toISOString(), totalValue.toString()].join("|");
  const verificationHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { approvedL2ById: user.id, approvedL2At: new Date(), verificationHash },
  });
  await writeAuditLog(user, "APPROVE_PO_L2", "PurchaseOrder", poId, `PO ${po.poNumber} disetujui Presdir: ${user.name}`);
  await notifyPoApprovedL2({
    poId: po.id,
    poNumber: po.poNumber,
    createdById: po.createdById,
    presdirName: user.name,
  });
  revalidatePath(`/purchasing/purchase-orders/${poId}`);
}
async function cancelPoWithReason(poId: string, reason: string) {
  "use server";
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") return { error: "Unauthorized" };
  if (!reason || !reason.trim()) return { error: "Alasan pembatalan wajib diisi" };

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { receivings: true },
  });
  if (!po) return { error: "PO tidak ditemukan" };
  if (["CLOSED", "CANCELLED"].includes(po.status)) {
    return { error: `PO berstatus ${po.status} tidak dapat dibatalkan` };
  }
  if (po.receivings.length > 0) {
    return { error: "PO tidak dapat dibatalkan karena sudah ada barang fisik yang diterima di gudang." };
  }

  const roleLabel =
    user.approvalLevel === 2 ? "Presdir"
    : user.approvalLevel === 1 ? "Manager Purchasing"
    : "Purchasing";

  const cancelStamp = `\n[DIBATALKAN oleh ${user.name} (${roleLabel}) pada ${new Date().toLocaleString("id-ID")}]: ${reason.trim()}`;

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "CANCELLED",
      notes: `${po.notes ?? ""}${cancelStamp}`.trim(),
      // Reset persetujuan saat dibatalkan
      approvedById: null,
      approvedAt: null,
      approvedL2ById: null,
      approvedL2At: null,
      verificationHash: null,
    },
  });

  await writeAuditLog(
    user,
    "CANCEL_PO",
    "PurchaseOrder",
    poId,
    `PO ${po.poNumber} dibatalkan oleh ${user.name} (${roleLabel}). Alasan: ${reason.trim()}`
  );

  // Berikan notifikasi In-App & Web Push ke Supplier terkait
  await notifyPoCancelledToSupplier({
    poId: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    cancelledByName: `${user.name} (${roleLabel})`,
    reason: reason.trim(),
  });

  revalidatePath(`/purchasing/purchase-orders/${poId}`);
  revalidatePath("/purchasing/purchase-orders");
  revalidatePath("/purchasing");
  revalidatePath(`/supplier/purchase-orders/${poId}`);
  revalidatePath("/supplier/purchase-orders");
  return { success: true };
}

async function closePo(poId: string) {
  "use server";
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") return;
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po || po.status === "CLOSED") return;
  await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "CLOSED" } });
  await writeAuditLog(user, "CLOSE_PO", "PurchaseOrder", poId, `PO ${po.poNumber} ditutup manual`);
  revalidatePath(`/purchasing/purchase-orders/${poId}`);
}

export default async function PurchaseOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const canApproveL1 = user.approvalLevel === 1; // Manager Purchasing
  const canApproveL2 = user.approvalLevel === 2; // Presdir

  // Ambil daftar PO yang belum di-TTD untuk navigasi Prev / Next
  let unapprovedPos: Array<{ id: string; poNumber: string }> = [];
  if (canApproveL1) {
    unapprovedPos = await prisma.purchaseOrder.findMany({
      where: {
        approvedById: null,
        status: { not: "CANCELLED" },
      },
      orderBy: [{ poDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, poNumber: true },
    });
  } else if (canApproveL2) {
    unapprovedPos = await prisma.purchaseOrder.findMany({
      where: {
        approvedById: { not: null },
        approvedL2ById: null,
        status: { not: "CANCELLED" },
      },
      orderBy: [{ poDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, poNumber: true },
    });
  }

  const currentUnapprovedIdx = unapprovedPos.findIndex((p) => p.id === id);
  let prevPo: { id: string; poNumber: string } | null = null;
  let nextPo: { id: string; poNumber: string } | null = null;

  if (currentUnapprovedIdx !== -1) {
    if (currentUnapprovedIdx > 0) {
      prevPo = unapprovedPos[currentUnapprovedIdx - 1];
    }
    if (currentUnapprovedIdx < unapprovedPos.length - 1) {
      nextPo = unapprovedPos[currentUnapprovedIdx + 1];
    }
  } else {
    if (unapprovedPos.length > 0) {
      nextPo = unapprovedPos[0];
    }
  }

  const [po, revisionLogs] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        createdBy: true,
        approvedBy: true,
        approvedL2By: true,
        details: { include: { item: true } },
        deliveries: {
          include: {
            supplier: true,
            details: {
              include: { item: true },
            },
            receivings: {
              include: {
                warehouse: true,
                details: { include: { item: true } },
              },
            },
          },
          orderBy: { shipDate: "desc" },
        },
        receivings: {
          include: {
            warehouse: true,
            delivery: true,
            details: { include: { item: true } },
          },
          orderBy: { receivedAt: "desc" },
        },
      },
    }),
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

  // Hitung jumlah penerimaan secara dinamis dari tabel ReceivingDetail
  const receivedByItem = new Map<string, number>();
  for (const rec of po.receivings) {
    for (const rd of rec.details) {
      receivedByItem.set(rd.itemId, (receivedByItem.get(rd.itemId) || 0) + rd.qtyReceived);
    }
  }

  const computedDetails = po.details.map((d) => ({
    ...d,
    receivedQty: receivedByItem.get(d.itemId) || 0,
  }));

  const totalQty = computedDetails.reduce((s, d) => s + d.qty, 0);
  const receivedQty = computedDetails.reduce((s, d) => s + d.receivedQty, 0);
  const totalValue = computedDetails.reduce((s, d) => s + d.qty * Number(d.unitPrice), 0);
  const canSend = ["DRAFT", "REVISED"].includes(po.status);
  const isApprover = (user.approvalLevel || 0) > 0;
  // Manager Purchasing dan Presdir TIDAK BISA hapus PO (hanya staff / non-approver di status DRAFT/CANCELLED)
  const canDelete = !isApprover && ["DRAFT", "CANCELLED"].includes(po.status);
  // Manager, Presdir, dan Staff BISA membatalkan PO selama belum CLOSED/CANCELLED dan belum ada barang diterima
  const canCancel = !["CLOSED", "CANCELLED"].includes(po.status) && po.receivings.length === 0;
  const canClose = !["CLOSED", "CANCELLED"].includes(po.status);
  const canRevise = !["CLOSED", "CANCELLED"].includes(po.status);

  // Serialized data for the interactive PoDeliveryReceivingView component
  const serializedDeliveries = po.deliveries.map((dlv) => ({
    id: dlv.id,
    deliveryNumber: dlv.deliveryNumber,
    suratJalan: dlv.suratJalan,
    shipDate: dlv.shipDate.toISOString(),
    status: dlv.status,
    supplier: dlv.supplier ? { name: dlv.supplier.name } : null,
    details: dlv.details.map((det) => ({
      id: det.id,
      qty: det.qty,
      unitPrice: Number(det.unitPrice),
      item: {
        id: det.item.id,
        code: det.item.code,
        name: det.item.name,
        unit: det.item.unit,
        packageUnit: det.item.packageUnit,
        packageSize: det.item.packageSize ? Number(det.item.packageSize) : null,
      },
    })),
    receivings: dlv.receivings.map((rcv) => ({
      id: rcv.id,
      receivingNumber: rcv.receivingNumber,
      status: rcv.status,
      receivedAt: rcv.receivedAt.toISOString(),
      warehouse: rcv.warehouse ? { name: rcv.warehouse.name } : null,
      notes: rcv.notes,
      details: rcv.details.map((rd) => ({
        id: rd.id,
        deliveryDetailId: rd.deliveryDetailId,
        itemId: rd.itemId,
        qtyOrdered: rd.qtyOrdered,
        qtyDelivered: rd.qtyDelivered,
        qtyReceived: rd.qtyReceived,
        notes: rd.notes,
      })),
    })),
  }));

  const serializedReceivings = po.receivings.map((rcv) => ({
    id: rcv.id,
    receivingNumber: rcv.receivingNumber,
    receivedAt: rcv.receivedAt.toISOString(),
    status: rcv.status,
    warehouse: rcv.warehouse ? { name: rcv.warehouse.name } : null,
    delivery: rcv.delivery
      ? {
          id: rcv.delivery.id,
          deliveryNumber: rcv.delivery.deliveryNumber,
          suratJalan: rcv.delivery.suratJalan,
        }
      : null,
    details: rcv.details.map((rd) => ({
      id: rd.id,
      qtyReceived: rd.qtyReceived,
      qtyDelivered: rd.qtyDelivered,
      item: {
        id: rd.item.id,
        code: rd.item.code,
        name: rd.item.name,
        unit: rd.item.unit,
        packageUnit: rd.item.packageUnit,
        packageSize: rd.item.packageSize ? Number(rd.item.packageSize) : null,
      },
    })),
  }));

  const poItemsSummary = computedDetails.map((d) => ({
    id: d.id,
    itemId: d.itemId,
    name: d.item.name,
    code: d.item.code,
    qty: d.qty,
    unit: d.item.unit,
    packageUnit: d.item.packageUnit,
    packageSize: d.item.packageSize ? Number(d.item.packageSize) : null,
    receivedQty: d.receivedQty,
  }));

  const revSuffix = po.revisionCount > 0 ? ` REV ${String(po.revisionCount).padStart(2, "0")}` : "";
  const displayPoNumber = `${po.poNumber}${revSuffix}`;

  const EN_STATUS_MAP: Record<string, string> = {
    DRAFT: "Draft",
    SENT: "Sent to Supplier",
    WAITING_DELIVERY: "Waiting Delivery",
    PARTIALLY_DELIVERED: "Partially Delivered",
    WAITING_RECEIVING: "Waiting Receiving",
    PARTIALLY_RECEIVED: "Partially Received",
    RECEIVED: "Received",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  };

  return (
    <div className="space-y-4">
      {/* ─── BANNER NAVIGASI PO BELUM DI-TTD (PREVIOUS & NEXT) ─── */}
      {(prevPo || nextPo) && (
        <div
          className={`flex items-center justify-between border rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
            canApproveL2
              ? "bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border-emerald-200/90"
              : "bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 border-amber-200/90"
          }`}
        >
          <div>
            {prevPo ? (
              <Link
                href={`/purchasing/purchase-orders/${prevPo.id}`}
                className={`inline-flex items-center gap-1.5 font-bold bg-white shadow-2xs px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  canApproveL2
                    ? "text-emerald-900 hover:text-emerald-950 hover:bg-emerald-50 border border-emerald-300/80"
                    : "text-amber-900 hover:text-amber-950 hover:bg-amber-50 border border-amber-300/80"
                }`}
                title={
                  isApprover
                    ? `Switch to Previous Pending PO: ${prevPo.poNumber}`
                    : `Beralih ke PO Sebelumnya yang Belum Di-TTD: ${prevPo.poNumber}`
                }
              >
                <ChevronLeft className={`w-4 h-4 ${canApproveL2 ? "text-emerald-700" : "text-amber-700"}`} />
                <span>{isApprover ? `Previous (${prevPo.poNumber})` : `Sebelumnya (${prevPo.poNumber})`}</span>
              </Link>
            ) : (
              <div />
            )}
          </div>

          <div
            className={`flex items-center gap-2 font-bold px-3 py-1 bg-white/80 rounded-xl border shadow-2xs ${
              canApproveL2
                ? "text-emerald-900 border-emerald-200/60"
                : "text-amber-900 border-amber-200/60"
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${canApproveL2 ? "text-emerald-600" : "text-amber-600"}`} />
            <span>
              {isApprover
                ? currentUnapprovedIdx !== -1
                  ? `Pending Approval: #${currentUnapprovedIdx + 1} of ${unapprovedPos.length}`
                  : `${unapprovedPos.length} More ${unapprovedPos.length === 1 ? "PO" : "POs"} Awaiting Approval`
                : currentUnapprovedIdx !== -1
                ? `PO Belum Di-TTD: Ke-${currentUnapprovedIdx + 1} dari ${unapprovedPos.length}`
                : `${unapprovedPos.length} PO Lain Masih Menunggu TTD`}
            </span>
          </div>

          <div>
            {nextPo ? (
              <Link
                href={`/purchasing/purchase-orders/${nextPo.id}`}
                className={`inline-flex items-center gap-1.5 font-bold bg-white shadow-2xs px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  canApproveL2
                    ? "text-emerald-900 hover:text-emerald-950 hover:bg-emerald-50 border border-emerald-300/80"
                    : "text-amber-900 hover:text-amber-950 hover:bg-amber-50 border border-amber-300/80"
                }`}
                title={
                  isApprover
                    ? `Switch to Next Pending PO: ${nextPo.poNumber}`
                    : `Beralih ke PO Selanjutnya yang Belum Di-TTD: ${nextPo.poNumber}`
                }
              >
                <span>{isApprover ? `Next (${nextPo.poNumber})` : `Selanjutnya (${nextPo.poNumber})`}</span>
                <ChevronRight className={`w-4 h-4 ${canApproveL2 ? "text-emerald-700" : "text-amber-700"}`} />
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      )}

      <PageTitle
        title={displayPoNumber}
        subtitle={`${po.supplier.name} · ${isApprover ? "Created" : "Dibuat"} ${formatDateOnly(po.poDate)}`}
        breadcrumb={["Purchase Orders", displayPoNumber]}
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge color={statusColor(po.status)}>
              {isApprover ? (EN_STATUS_MAP[po.status] || po.status) : (PO_STATUS_LABEL[po.status] || po.status)}
            </Badge>
            {po.revisionCount > 0 && (
              <Badge color="amber" className="font-mono font-bold">
                REV {String(po.revisionCount).padStart(2, "0")}
              </Badge>
            )}
            {/* Badge status approval berjenjang */}
            {po.approvedById && !po.approvedL2ById && (
              <Badge color="amber">
                <ShieldCheck className="w-3 h-3 inline mr-1" />
                {canApproveL2 ? "Awaiting Your Approval (Presdir)" : isApprover ? "Awaiting Presdir Approval" : "Menunggu Presdir"}
              </Badge>
            )}
            {po.approvedL2ById && (
              <Badge color="green">
                <ShieldCheck className="w-3 h-3 inline mr-1" />
                Fully Approved
              </Badge>
            )}
            {po.supplierAcceptedAt && (
              <Badge color="green">
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                {isApprover ? "Supplier Signed" : "TTD Supplier Lengkap"}
              </Badge>
            )}
            {/* Staff only: Kirim ke supplier & Buka Draf Gmail */}
            {!isApprover && canSend && (
              <SendPoButton
                poId={po.id}
                poNumber={po.poNumber}
                poDate={formatDateOnly(po.poDate)}
                supplier={{
                  name: po.supplier.name,
                  email: po.supplier.email,
                  contactPerson: po.supplier.contactPerson,
                }}
                details={computedDetails.map((d) => ({
                  itemName: d.item.name,
                  qty: d.qty,
                  unit: d.item.unit || "kg",
                }))}
                purposeProject={po.purposeProject || po.department}
                expectedDelivery={po.expectedDelivery ? formatDateOnly(po.expectedDelivery) : null}
                onSendPoAction={sendPo}
              />
            )}
            {/* L1: Manager approve — hanya jika belum ada L1 approval dan belum cancelled */}
            {canApproveL1 && !po.approvedById && po.status !== "CANCELLED" && (
              <form action={approvePoL1.bind(null, po.id)} className="m-0">
                <Button type="submit" variant="success" className="gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  Approve (Manager)
                </Button>
              </form>
            )}
            {/* L2: Presdir approve — hanya bisa setelah L1 selesai dan belum cancelled */}
            {canApproveL2 && po.approvedById && !po.approvedL2ById && po.status !== "CANCELLED" && (
              <form action={approvePoL2.bind(null, po.id)} className="m-0">
                <Button type="submit" variant="success" className="gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  Sign &amp; Approve (Presdir)
                </Button>
              </form>
            )}
            {/* Info jika Presdir belum bisa approve */}
            {canApproveL2 && !po.approvedById && (
              <span className="text-xs text-slate-400 italic">Awaiting Manager (L1) Verification</span>
            )}
            <Link href={`/purchasing/purchase-orders/${po.id}/print`} target="_blank">
              <Button variant="secondary" className="gap-1.5 border-slate-200">
                <Printer className="w-4 h-4 text-slate-600" />
                {isApprover ? "Print / PDF" : "Cetak / PDF"}
              </Button>
            </Link>
            {/* Staff only: Revisi dan Close */}
            {!isApprover && canRevise && (
              <Link href={`/purchasing/purchase-orders/${po.id}/revise`}>
                <Button variant="secondary" className="border-slate-200">Revisi</Button>
              </Link>
            )}
            {!isApprover && canClose && (
              <form action={closePo.bind(null, po.id)} className="m-0">
                <Button type="submit" variant="success">Close</Button>
              </form>
            )}
            {canCancel && (
              <CancelPoButton
                poId={po.id}
                poNumber={po.poNumber}
                supplierName={po.supplier.name}
                onCancelPo={cancelPoWithReason}
                isEnglish={isApprover}
              />
            )}
            {canDelete && (
              <DeletePoButton
                poId={po.id}
                poNumber={po.poNumber}
                supplierName={po.supplier.name}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">{isApprover ? "Information" : "Informasi"}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-slate-500">PO Number</dt>
              <dd className="font-semibold text-slate-900 flex items-center gap-1.5">
                <span>{po.poNumber}</span>
                {po.revisionCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white font-mono text-[10px] font-bold">
                    REV {String(po.revisionCount).padStart(2, "0")}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-slate-500">Supplier</dt><dd className="font-medium text-slate-800">{po.supplier.name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Warehouse</dt><dd className="font-medium text-slate-800">{po.warehouse?.name ?? "-"}</dd></div>
            {po.department && (
              <div className="flex justify-between"><dt className="text-slate-500">{isApprover ? "Department" : "Departemen"}</dt><dd className="font-medium text-slate-800">{po.department}</dd></div>
            )}
            {po.purposeProject && (
              <div className="flex justify-between"><dt className="text-slate-500">Project / Purpose</dt><dd className="font-medium text-slate-800 text-right max-w-[180px]">{po.purposeProject}</dd></div>
            )}
            {po.notes && (
              <div className="flex justify-between"><dt className="text-slate-500">Quotation / Remarks</dt><dd className="font-medium text-slate-800 text-right max-w-[200px]">{po.notes}</dd></div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Expected Delivery</dt>
              <dd className="font-medium text-slate-800">
                {po.expectedDelivery
                  ? po.deliveryDateType === "MONTH"
                    ? new Intl.DateTimeFormat(isApprover ? "en-US" : "id-ID", { month: "long", year: "numeric" }).format(new Date(po.expectedDelivery))
                    : formatDateOnly(po.expectedDelivery)
                  : "-"}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-slate-500">{isApprover ? "Total Items" : "Total Item"}</dt><dd className="font-medium text-slate-800">{totalQty}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{isApprover ? "Received" : "Diterima"}</dt><dd className="font-semibold text-emerald-600">{receivedQty} / {totalQty}</dd></div>
            <div className="flex justify-between pt-2 border-t border-slate-100"><dt className="text-slate-500 font-semibold">{isApprover ? "Total Amount" : "Total Nilai"}</dt><dd className="font-bold text-slate-900">{formatMoney(totalValue)}</dd></div>
            {/* Approval Status Berjenjang */}
            {(po.approvedById || po.approvedL2ById) && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                {/* L1: Manager */}
                <div className={`space-y-1 pb-1.5 ${po.approvedL2ById ? "border-b border-slate-100" : ""}`}>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-700">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>L1 — {isApprover ? "Purchasing Manager" : "Manager Purchasing"}</span>
                  </div>
                  {po.approvedBy ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <dt className="text-slate-500">{isApprover ? "Approved by" : "Disetujui oleh"}</dt>
                        <dd className="font-medium text-slate-800">{po.approvedBy.name}</dd>
                      </div>
                      <div className="flex justify-between text-xs">
                        <dt className="text-slate-500">{isApprover ? "On" : "Pada"}</dt>
                        <dd className="font-medium text-slate-800">
                          {po.approvedAt ? new Intl.DateTimeFormat(isApprover ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(po.approvedAt)) : "-"}
                        </dd>
                      </div>
                    </>
                  ) : <p className="text-xs text-slate-400 italic">{isApprover ? "Pending approval" : "Belum disetujui"}</p>}
                </div>
                {/* L2: Presdir */}
                <div className="space-y-1">
                  <div className={`flex items-center gap-1.5 font-semibold text-xs ${po.approvedL2ById ? "text-emerald-700" : "text-slate-400"}`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>L2 — {isApprover ? "President Director" : "Presdir"} {!po.approvedL2ById && <span className="font-normal">({isApprover ? "pending" : "menunggu"})</span>}</span>
                  </div>
                  {po.approvedL2By ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <dt className="text-slate-500">{isApprover ? "Approved by" : "Disetujui oleh"}</dt>
                        <dd className="font-medium text-slate-800">{po.approvedL2By.name}</dd>
                      </div>
                      <div className="flex justify-between text-xs">
                        <dt className="text-slate-500">{isApprover ? "On" : "Pada"}</dt>
                        <dd className="font-medium text-slate-800">
                          {po.approvedL2At ? new Intl.DateTimeFormat(isApprover ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(po.approvedL2At)) : "-"}
                        </dd>
                      </div>
                      <div className="flex justify-between text-xs">
                        <dt className="text-slate-500">{isApprover ? "Purpose" : "Tujuan"}</dt>
                        <dd className="font-medium text-slate-800 text-right max-w-[160px]">{po.purposeProject || po.department || "-"}</dd>
                      </div>
                      <Link href={`/verify/${po.id}`} target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 hover:underline mt-1">
                        <ShieldCheck className="w-3 h-3" />
                        {isApprover ? "View Verification Page" : "Lihat Halaman Verifikasi"}
                      </Link>
                    </>
                  ) : <p className="text-xs text-slate-400 italic">{isApprover ? "Pending approval" : "Belum disetujui"}</p>}
                </div>

                {/* Supplier Confirmation & Signature */}
                <div className="space-y-1 pt-2.5 border-t border-slate-100">
                  <div className={`flex items-center gap-1.5 font-semibold text-xs ${po.supplierAcceptedAt ? "text-emerald-700" : "text-slate-400"}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isApprover ? "Supplier Acceptance & Signature" : "Konfirmasi & TTD Supplier"} {!po.supplierAcceptedAt && <span className="font-normal">({isApprover ? "pending" : "menunggu"})</span>}</span>
                  </div>
                  {po.supplierAcceptedAt ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <dt className="text-slate-500">{isApprover ? "Signed by" : "Ditandatangani oleh"}</dt>
                        <dd className="font-medium text-slate-800">{po.supplierAcceptedByName || po.supplier.name}</dd>
                      </div>
                      <div className="flex justify-between text-xs">
                        <dt className="text-slate-500">{isApprover ? "On" : "Pada"}</dt>
                        <dd className="font-medium text-slate-800">
                          {new Intl.DateTimeFormat(isApprover ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(po.supplierAcceptedAt))}
                        </dd>
                      </div>
                      {po.supplierAcceptedSignature && (
                        <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">{isApprover ? "Signature" : "Tanda Tangan"}</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={po.supplierAcceptedSignature}
                            alt="TTD Supplier"
                            className="h-9 max-w-[120px] object-contain border border-slate-200 rounded-lg p-1 bg-white shadow-2xs"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      {isApprover ? "Awaiting supplier confirmation & signature" : "Menunggu konfirmasi & tanda tangan pihak supplier"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">{isApprover ? "Item Details" : "Detail Item"}</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">{isApprover ? "Item" : "Item"}</th>
                <th className="px-5 py-3 font-medium">Qty PO</th>
                <th className="px-5 py-3 font-medium">Delivered</th>
                <th className="px-5 py-3 font-medium">Received</th>
                <th className="px-5 py-3 font-medium">Outstanding</th>
                <th className="px-5 py-3 font-medium text-right">{isApprover ? "Unit Price" : "Harga"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {computedDetails.map((d) => {
                const pkgUnit = d.item.packageUnit || "Pail";
                const pkgSize = Number(d.item.packageSize ?? 1);
                const poPkgQty = d.packageQty ?? (pkgSize > 0 ? Math.ceil(d.qty / pkgSize) : d.qty);
                const recvPkgQty = d.receivedPackageQty > 0 ? d.receivedPackageQty : (pkgSize > 0 ? Math.floor(d.receivedQty / pkgSize) : d.receivedQty);

                return (
                  <tr key={d.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{d.item.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {d.item.code} · Spek: 1 {pkgUnit} = {pkgSize} {d.item.unit || "kg"}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {d.qty} {d.item.unit || "kg"}
                      <div className="text-xs text-slate-400 font-normal">({poPkgQty} {pkgUnit})</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{d.deliveredQty} {d.item.unit || "kg"}</td>
                    <td className="px-5 py-3 text-emerald-600 font-semibold">
                      {d.receivedQty} {d.item.unit || "kg"}
                      <div className="text-xs text-emerald-500 font-normal">({recvPkgQty} {pkgUnit})</div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-amber-600">
                      {Math.max(0, d.qty - d.receivedQty)} {d.item.unit || "kg"}
                    </td>
                    <td className="px-5 py-3 text-right">{formatMoney(d.unitPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ─── RIWAYAT LOG REVISI PO ─── */}
      {revisionLogs.length > 0 && (
        <Card className="overflow-hidden border-amber-200 shadow-sm">
          <div className="bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50/20 border-b border-amber-200/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shadow-xs">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {isApprover ? "PO Revision History" : "Riwayat Log Revisi PO"}
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
                    {revisionLogs.length} {isApprover ? (revisionLogs.length === 1 ? "Revision" : "Revisions") : "Kali Revisi"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isApprover
                    ? "Audit trail detailing item changes, quantity adjustments, price changes, and revision reasons."
                    : "Audit trail detail perubahan item, perubahan kuantitas (qty), perubahan harga, dan alasan revisi"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4 divide-y divide-slate-100">
            {revisionLogs.map((log, idx) => {
              let parsed: any = null;
              try {
                if (log.detail && log.detail.startsWith("{")) {
                  parsed = JSON.parse(log.detail);
                }
              } catch {
                parsed = null;
              }

              const revTag = parsed?.revisionTag || `REV ${String(revisionLogs.length - idx).padStart(2, "0")}`;
              const categories: string[] = parsed?.categories || [];
              const reason = parsed?.reason || (!parsed ? log.detail : (isApprover ? "PO detail update" : "Pembaruan detail PO"));
              const userLabel = log.user?.name || parsed?.revisedBy || "Purchasing";
              const formattedDate = new Intl.DateTimeFormat(isApprover ? "en-US" : "id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(log.createdAt));

              return (
                <div key={log.id} className={idx > 0 ? "pt-4" : ""}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded bg-amber-700 text-white font-mono text-xs font-bold tracking-wide shadow-xs">
                        {revTag}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">{userLabel}</span>
                        <span>·</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    {/* Category Badges */}
                    {categories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {categories.map((cat) => {
                          const isItem = cat.includes("Item");
                          const isQty = cat.includes("Qty");
                          const isPrice = cat.includes("Harga") || cat.includes("Price");
                          const colorClass = isItem
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : isQty
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : isPrice
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-amber-100 text-amber-800 border-amber-200";

                          const label = isApprover
                            ? isItem
                              ? "Item Changes"
                              : isQty
                              ? "Quantity Changes"
                              : isPrice
                              ? "Price Changes"
                              : cat
                            : cat;

                          return (
                            <span
                              key={cat}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${colorClass}`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Alasan Revisi */}
                  <div className="mt-2.5 rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs">
                    <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isApprover ? "Revision Reason (Why was it revised?):" : "Alasan Revisi (Mengapa Direvisi?):"}</span>
                    </div>
                    <p className="text-slate-800 italic bg-white p-2 rounded border border-slate-200">
                      "{reason}"
                    </p>
                  </div>

                  {/* Rincian Perubahan Terstruktur */}
                  {parsed && (parsed.itemChanges?.length > 0 || parsed.qtyChanges?.length > 0 || parsed.priceChanges?.length > 0 || parsed.metaChanges?.length > 0) && (
                    <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {/* Qty Changes */}
                      {parsed.qtyChanges?.length > 0 && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5">
                          <div className="font-bold text-blue-900 mb-1 flex items-center gap-1">
                            <span>{isApprover ? "🔢 Quantity Changes:" : "🔢 Perubahan Qty:"}</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-blue-950 text-[11px]">
                            {parsed.qtyChanges.map((q: string, i: number) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Item Changes */}
                      {parsed.itemChanges?.length > 0 && (
                        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-2.5">
                          <div className="font-bold text-purple-900 mb-1 flex items-center gap-1">
                            <span>{isApprover ? "🏷️ Item Changes (Add / Remove):" : "🏷️ Perubahan Item (Tambah / Hapus):"}</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-purple-950 text-[11px]">
                            {parsed.itemChanges.map((it: string, i: number) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Price Changes */}
                      {parsed.priceChanges?.length > 0 && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
                          <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                            <span>{isApprover ? "💰 Unit Price Changes:" : "💰 Perubahan Harga Satuan:"}</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-emerald-950 text-[11px]">
                            {parsed.priceChanges.map((pr: string, i: number) => (
                              <li key={i}>{pr}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Meta Changes */}
                      {parsed.metaChanges?.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                          <div className="font-bold text-amber-900 mb-1 flex items-center gap-1">
                            <span>{isApprover ? "🏢 PO Details / Schedule Changes:" : "🏢 Perubahan Data PO / Jadwal:"}</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-950 text-[11px]">
                            {parsed.metaChanges.map((m: string, i: number) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Interactive Delivery & Receiving View (Staff only; approvers are restricted to PO review) */}
      {!isApprover && (
        <PoDeliveryReceivingView
          deliveries={serializedDeliveries}
          receivings={serializedReceivings}
          poItems={poItemsSummary}
        />
      )}
    </div>
  );
}
