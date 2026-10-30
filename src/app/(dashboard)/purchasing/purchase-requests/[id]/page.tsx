"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageTitle, Card, Badge, Button } from "@/components/ui";
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Send,
  Trash2,
  Edit,
  ExternalLink,
  User,
  Building,
  Calendar,
  Layers,
  Sparkles,
  Printer,
  Truck,
  PackageCheck,
  Package,
  Boxes,
  AlertCircle,
  Check,
  UserCheck,
  CheckSquare,
  Award,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  FileSignature,
} from "lucide-react";
import { PR_STATUS_LABEL } from "@/lib/utils";

type DeliveryRecord = {
  id: string;
  deliveryNumber: string;
  suratJalan: string;
  shipDate: string;
  status: string;
  notes?: string | null;
  poNumber: string;
  supplier?: { id: string; name: string };
  createdBy?: { id: string; name: string };
  details: Array<{
    id: string;
    qty: number;
    item?: { id: string; code: string; name: string; unit?: string | null };
  }>;
};

type ReceivingRecord = {
  id: string;
  receivingNumber: string;
  receivedAt: string;
  status: string;
  notes?: string | null;
  poNumber: string;
  warehouse?: { id: string; name: string };
  receivedBy?: { id: string; name: string };
  delivery?: {
    id: string;
    deliveryNumber: string;
    suratJalan: string;
    shipDate: string;
    supplier?: { id: string; name: string };
  };
  details: Array<{
    id: string;
    qtyOrdered: number;
    qtyDelivered: number;
    qtyReceived: number;
    item?: { id: string; code: string; name: string; unit?: string | null };
  }>;
};

type LinkedPORecord = {
  id: string;
  poNumber: string;
  status: string;
  poDate: string;
  supplier: string;
  approvedL1?: { approvedAt: string; approver?: string } | null;
  approvedL2?: { approvedAt: string; approver?: string; hash?: string } | null;
  supplierAccepted?: { acceptedAt: string; name?: string } | null;
  totalPoQty: number;
  totalDeliveredQty: number;
  totalReceivedQty: number;
  isDeliveredAll: boolean;
  isDeliveredPartial: boolean;
  isReceivedAll: boolean;
  isReceivedPartial: boolean;
};

type PRDetail = {
  id: string;
  prNumber: string;
  department: string;
  requestDate: string;
  requiredDate: string | null;
  urgency: "NORMAL" | "URGENT";
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "PARTIAL_PO"
    | "ORDERED"
    | "PARTIAL_RECEIVED"
    | "COMPLETED"
    | "CONVERTED"
    | "CANCELLED";
  purposeNotes: string | null;
  attachmentUrl: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  requestedBy: { id: string; name: string; username: string; email: string | null };
  approvedBy?: { id: string; name: string; username: string } | null;
  rejectedBy?: { id: string; name: string; username: string } | null;
  supplier?: { id: string; name: string; code: string } | null;
  canViewPrice?: boolean;
  deliveries?: DeliveryRecord[];
  receivings?: ReceivingRecord[];
  linkedPOs?: LinkedPORecord[];
  details: Array<{
    id: string;
    itemId: string | null;
    customItemName: string | null;
    specifications: string | null;
    qty: number;
    unit: string | null;
    estimatedPrice: number | null;
    notes: string | null;
    status: "PENDING" | "ORDERED" | "PARTIAL_RECEIVED" | "RECEIVED" | "CANCELLED";
    orderedQty: number;
    totalOrdered?: number;
    totalReceived?: number;
    totalDelivered?: number;
    outstandingQty?: number;
    item?: { id: string; code: string; name: string; unit: string | null } | null;
    poDetails?: Array<{
      id: string;
      qty: number;
      receivedQty: number;
      deliveredQty: number;
      purchaseOrder: {
        id: string;
        poNumber: string;
        status: string;
        poDate: string;
        supplier: { id: string; name: string };
        approvedAt?: string | null;
        approvedBy?: { id: string; name: string; username: string } | null;
        approvedL2At?: string | null;
        approvedL2By?: { id: string; name: string; username: string } | null;
        verificationHash?: string | null;
        supplierAcceptedAt?: string | null;
        supplierAcceptedByName?: string | null;
      };
      deliveryDetails?: Array<{
        id: string;
        qty: number;
        delivery: {
          id: string;
          deliveryNumber: string;
          suratJalan: string;
          shipDate: string;
          status: string;
        };
      }>;
    }>;
  }>;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeColor: "gray" | "blue" | "green" | "red" | "yellow" | "purple" }
> = {
  DRAFT: { label: "Draft", badgeColor: "gray" },
  PENDING_APPROVAL: { label: "Menunggu Approval", badgeColor: "yellow" },
  APPROVED: { label: "Disetujui (Siap PO)", badgeColor: "blue" },
  PARTIAL_PO: { label: "Sebagian Masuk PO", badgeColor: "blue" },
  ORDERED: { label: "Sudah PO (Menunggu Barang)", badgeColor: "purple" },
  PARTIAL_RECEIVED: { label: "Diterima Sebagian di Gudang", badgeColor: "yellow" },
  COMPLETED: { label: "Selesai (Barang Diterima)", badgeColor: "green" },
  CONVERTED: { label: "Sudah Jadi PO", badgeColor: "purple" },
  REJECTED: { label: "Ditolak", badgeColor: "red" },
  CANCELLED: { label: "Dibatalkan", badgeColor: "gray" },
};

export default function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [pr, setPr] = useState<PRDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDetailIds, setSelectedDetailIds] = useState<string[]>([]);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [prRes, userRes] = await Promise.all([
        fetch(`/api/purchase-requests/${id}`),
        fetch("/api/user/profile").catch(() => null),
      ]);

      if (prRes.ok) {
        const data = await prRes.json();
        setPr(data);
      } else {
        const errData = await prRes.json();
        setError(errData.error || "Gagal memuat Purchase Request");
      }

      if (userRes && userRes.ok) {
        const u = await userRes.json();
        setCurrentUser(u);
      }
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleApproval(decision: "APPROVE" | "REJECT") {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: decision === "REJECT" ? rejectReason : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memproses approval");
        return;
      }

      setShowRejectModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeletePR() {
    if (!confirm("Apakah Anda yakin ingin menghapus Purchase Request ini?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/purchase-requests/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menghapus PR");
        return;
      }
      router.push("/purchasing/purchase-requests");
    } catch (e: any) {
      alert(e.message || "Terjadi kesalahan");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28 gap-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm">Memuat detail Purchase Request...</span>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="text-center py-20 space-y-3">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Purchase Request Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">{error || "Data PR mungkin telah dihapus."}</p>
        <Link href="/purchasing/purchase-requests">
          <Button variant="secondary" className="mt-2 text-xs !py-1.5 !px-3">
            Kembali ke Daftar PR
          </Button>
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[pr.status] || { label: pr.status, badgeColor: "gray" };
  const isUrgent = pr.urgency === "URGENT";

  const isApproverUser =
    currentUser?.role === "DEPT_APPROVER" &&
    Array.isArray(currentUser?.departments) &&
    currentUser.departments.includes(pr.department);

  const isPurchasingUser = currentUser?.role === "PURCHASING";
  const isOwner = currentUser?.id === pr.requestedBy.id;

  const pendingDetails = pr.details.filter(
    (d) => d.status === "PENDING" && !(d.poDetails && d.poDetails.length > 0)
  );

  function toggleDetail(detailId: string) {
    setSelectedDetailIds((prev) =>
      prev.includes(detailId) ? prev.filter((id) => id !== detailId) : [...prev, detailId]
    );
  }

  function toggleSelectAllPending() {
    if (selectedDetailIds.length === pendingDetails.length) {
      setSelectedDetailIds([]);
    } else {
      setSelectedDetailIds(pendingDetails.map((d) => d.id));
    }
  }

  const linkedOrders: LinkedPORecord[] = pr.linkedPOs || [];

  const canSeePrice = pr.canViewPrice ?? (currentUser?.role === "PURCHASING");
  const totalQtyRequested = pr.details.reduce((sum, d) => sum + d.qty, 0);
  const totalQtyOrdered = pr.details.reduce((sum, d) => sum + (d.totalOrdered ?? 0), 0);
  const totalQtyReceived = pr.details.reduce((sum, d) => sum + (d.totalReceived ?? 0), 0);
  const totalQtyDelivered = pr.details.reduce((sum, d) => sum + (d.totalDelivered ?? 0), 0);
  const totalQtyOutstanding = Math.max(0, totalQtyRequested - totalQtyReceived);
  const percentOrdered = totalQtyRequested > 0 ? Math.round((totalQtyOrdered / totalQtyRequested) * 100) : 0;
  const percentReceived = totalQtyRequested > 0 ? Math.round((totalQtyReceived / totalQtyRequested) * 100) : 0;
  const outstandingDetails = pr.details.filter((d) => (d.outstandingQty ?? 0) > 0);

  const deliveries = pr.deliveries || [];
  const receivings = pr.receivings || [];

  // Status Approval L1 & L2 di semua PO yang terbit
  const hasLinkedOrders = linkedOrders.length > 0;
  const allPoL1Approved = hasLinkedOrders && linkedOrders.every((p) => Boolean(p.approvedL1));
  const anyPoL1Approved = hasLinkedOrders && linkedOrders.some((p) => Boolean(p.approvedL1));
  const allPoL2Approved = hasLinkedOrders && linkedOrders.every((p) => Boolean(p.approvedL2));
  const anyPoL2Approved = hasLinkedOrders && linkedOrders.some((p) => Boolean(p.approvedL2));

  // Nama-nama approver L1 dan L2
  const l1ApproverNames = Array.from(
    new Set(linkedOrders.map((p) => p.approvedL1?.approver).filter(Boolean))
  ).join(", ");
  const l2ApproverNames = Array.from(
    new Set(linkedOrders.map((p) => p.approvedL2?.approver).filter(Boolean))
  ).join(", ");

  // Definisi 7 Tahap Siklus Lengkap (Lifecycle Stepper)
  const lifecycleSteps = [
    {
      stepNumber: 1,
      title: "PR Dibuat",
      icon: FileText,
      status: "COMPLETED",
      badgeText: "Diajukan",
      badgeColor: "emerald" as const,
      timestamp: pr.requestDate,
      summary: `Diajukan oleh ${pr.requestedBy.name}`,
      detail: `Departemen: ${pr.department} • Total ${pr.details.length} item (${totalQtyRequested} unit)`,
    },
    {
      stepNumber: 2,
      title: "Persetujuan Dept",
      icon: UserCheck,
      status:
        pr.status === "REJECTED"
          ? "REJECTED"
          : pr.status === "PENDING_APPROVAL"
          ? "CURRENT"
          : "COMPLETED",
      badgeText:
        pr.status === "REJECTED"
          ? "Ditolak"
          : pr.status === "PENDING_APPROVAL"
          ? "Menunggu Approval"
          : "Disetujui",
      badgeColor:
        pr.status === "REJECTED"
          ? ("rose" as const)
          : pr.status === "PENDING_APPROVAL"
          ? ("amber" as const)
          : ("emerald" as const),
      timestamp: pr.rejectedAt || pr.approvedAt || null,
      summary:
        pr.status === "REJECTED"
          ? `Ditolak oleh ${pr.rejectedBy?.name || "Approver"}`
          : pr.status === "PENDING_APPROVAL"
          ? `Menunggu SPV / Manager ${pr.department}`
          : `Disetujui oleh ${pr.approvedBy?.name || "Supervisor Departemen"}`,
      detail:
        pr.status === "REJECTED" && pr.rejectReason
          ? `Alasan: "${pr.rejectReason}"`
          : pr.status === "PENDING_APPROVAL"
          ? "Persetujuan internal departemen diperlukan sebelum Purchasing membuat PO"
          : "Disetujui penuh & siap diterbitkan PO oleh Purchasing",
    },
    {
      stepNumber: 3,
      title: "Penerbitan PO",
      icon: ShoppingBag,
      status:
        !hasLinkedOrders
          ? ["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(pr.status)
            ? "UPCOMING"
            : "CURRENT"
          : totalQtyOrdered >= totalQtyRequested
          ? "COMPLETED"
          : "PARTIAL",
      badgeText:
        !hasLinkedOrders
          ? "Belum PO"
          : totalQtyOrdered >= totalQtyRequested
          ? "PO Lengkap (100%)"
          : `PO Sebagian (${percentOrdered}%)`,
      badgeColor:
        !hasLinkedOrders
          ? ("slate" as const)
          : totalQtyOrdered >= totalQtyRequested
          ? ("emerald" as const)
          : ("blue" as const),
      timestamp: linkedOrders[0]?.poDate || null,
      summary:
        !hasLinkedOrders
          ? "Menunggu Purchasing menerbitkan PO"
          : totalQtyOrdered >= totalQtyRequested
          ? `Seluruh kebutuhan (${totalQtyOrdered} unit) telah dibuatkan PO`
          : `Sebagian kebutuhan (${totalQtyOrdered} dari ${totalQtyRequested} unit) dibuatkan PO`,
      detail:
        hasLinkedOrders
          ? `PO Terbit: ${linkedOrders.map((p) => p.poNumber).join(", ")}`
          : "Purchasing memplot supplier & kuantiti pemesanan",
    },
    {
      stepNumber: 4,
      title: "Approval PO L1",
      icon: CheckSquare,
      status:
        !hasLinkedOrders
          ? "UPCOMING"
          : allPoL1Approved
          ? "COMPLETED"
          : anyPoL1Approved
          ? "PARTIAL"
          : "CURRENT",
      badgeText:
        !hasLinkedOrders
          ? "Menunggu PO"
          : allPoL1Approved
          ? "Disetujui L1"
          : anyPoL1Approved
          ? "L1 Sebagian"
          : "Menunggu L1",
      badgeColor:
        !hasLinkedOrders
          ? ("slate" as const)
          : allPoL1Approved
          ? ("emerald" as const)
          : anyPoL1Approved
          ? ("blue" as const)
          : ("amber" as const),
      timestamp: linkedOrders.find((p) => p.approvedL1)?.approvedL1?.approvedAt || null,
      summary:
        !hasLinkedOrders
          ? "Tahap berikutnya setelah PO terbit"
          : allPoL1Approved
          ? `Disetujui Manager Purchasing (${l1ApproverNames || "Manager"})`
          : anyPoL1Approved
          ? "Sebagian PO telah disetujui Manager Purchasing"
          : "Menunggu tanda tangan Manager Purchasing (L1)",
      detail:
        allPoL1Approved
          ? "Verifikasi spesifikasi teknis & harga oleh Manager Purchasing selesai"
          : "Manager Purchasing memverifikasi kesesuaian harga & vendor",
    },
    {
      stepNumber: 5,
      title: "Approval PO L2",
      icon: Award,
      status:
        !allPoL1Approved
          ? "UPCOMING"
          : allPoL2Approved
          ? "COMPLETED"
          : anyPoL2Approved
          ? "PARTIAL"
          : "CURRENT",
      badgeText:
        !allPoL1Approved
          ? "Menunggu L1"
          : allPoL2Approved
          ? "Disetujui L2 (Presdir)"
          : anyPoL2Approved
          ? "L2 Sebagian"
          : "Menunggu L2",
      badgeColor:
        !allPoL1Approved
          ? ("slate" as const)
          : allPoL2Approved
          ? ("emerald" as const)
          : anyPoL2Approved
          ? ("blue" as const)
          : ("amber" as const),
      timestamp: linkedOrders.find((p) => p.approvedL2)?.approvedL2?.approvedAt || null,
      summary:
        !allPoL1Approved
          ? "Menunggu persetujuan Manager L1 terlebih dahulu"
          : allPoL2Approved
          ? `Disetujui Presdir (${l2ApproverNames || "Presdir"})`
          : anyPoL2Approved
          ? "Sebagian PO telah disetujui Direktur Utama / Presdir"
          : "Menunggu tanda tangan Direktur Utama / Presdir (L2)",
      detail:
        allPoL2Approved
          ? "Tanda tangan digital Presdir valid & hash verifikasi keamanan SHA-256 terbit"
          : "Persetujuan final manajemen puncak sebelum dikirim ke supplier",
    },
    {
      stepNumber: 6,
      title: "Pengiriman Vendor",
      icon: Truck,
      status:
        totalQtyDelivered === 0
          ? allPoL2Approved
            ? "CURRENT"
            : "UPCOMING"
          : totalQtyDelivered >= totalQtyOrdered && totalQtyOrdered > 0
          ? "COMPLETED"
          : "PARTIAL",
      badgeText:
        totalQtyDelivered === 0
          ? "Belum Ada Pengiriman"
          : totalQtyDelivered >= totalQtyOrdered && totalQtyOrdered > 0
          ? "Dikirim Seluruhnya"
          : `Dikirim Sebagian (${totalQtyDelivered}/${totalQtyOrdered})`,
      badgeColor:
        totalQtyDelivered === 0
          ? ("slate" as const)
          : totalQtyDelivered >= totalQtyOrdered && totalQtyOrdered > 0
          ? ("emerald" as const)
          : ("amber" as const),
      timestamp: deliveries[0]?.shipDate || null,
      summary:
        totalQtyDelivered === 0
          ? "Menunggu supplier menerbitkan Surat Jalan & mengirim barang"
          : totalQtyDelivered >= totalQtyOrdered && totalQtyOrdered > 0
          ? `Seluruh barang (${totalQtyDelivered} unit) telah dikirim supplier`
          : `Pengiriman parsial: ${totalQtyDelivered} dari ${totalQtyOrdered} unit telah dikirim supplier`,
      detail:
        deliveries.length > 0
          ? `Surat Jalan: ${deliveries.map((d) => d.suratJalan).join(", ")} (${deliveries.length} pengiriman)`
          : "Supplier memproses pesanan dan menyiapkan armada pengiriman",
    },
    {
      stepNumber: 7,
      title: "Diterima Warehouse",
      icon: PackageCheck,
      status:
        totalQtyReceived === 0
          ? totalQtyDelivered > 0
            ? "CURRENT"
            : "UPCOMING"
          : totalQtyReceived >= totalQtyRequested
          ? "COMPLETED"
          : "PARTIAL",
      badgeText:
        totalQtyReceived === 0
          ? "Belum Tiba"
          : totalQtyReceived >= totalQtyRequested
          ? "Diterima Lengkap (Selesai)"
          : `Diterima Sebagian (${totalQtyReceived}/${totalQtyRequested})`,
      badgeColor:
        totalQtyReceived === 0
          ? ("slate" as const)
          : totalQtyReceived >= totalQtyRequested
          ? ("emerald" as const)
          : ("amber" as const),
      timestamp: receivings[0]?.receivedAt || null,
      summary:
        totalQtyReceived === 0
          ? "Menunggu kedatangan fisik & pemeriksaan tim Warehouse"
          : totalQtyReceived >= totalQtyRequested
          ? `Seluruh barang (${totalQtyReceived} unit) diterima lengkap di gudang • PR SELESAI`
          : `Diterima sebagian: ${totalQtyReceived} dari ${totalQtyRequested} unit telah masuk gudang (Kurang ${totalQtyOutstanding} unit)`,
      detail:
        receivings.length > 0
          ? `LPB: ${receivings.map((r) => r.receivingNumber).join(", ")} • Diterima oleh tim Warehouse`
          : "Tim Warehouse akan melakukan scan barcode & verifikasi fisik barang",
    },
  ];

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/purchasing/purchase-requests">
            <button
              type="button"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                {pr.prNumber}
              </h1>
              <Badge color={cfg.badgeColor}>{cfg.label}</Badge>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  URGENT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Diajukan pada{" "}
              {new Date(pr.requestDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pr.status === "PENDING_APPROVAL" && !isApproverUser && (
            <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/90 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Menunggu Persetujuan Supervisor {pr.department}
            </span>
          )}

          {pr.status === "PENDING_APPROVAL" && isApproverUser && (
            <>
              <Button
                variant="danger"
                disabled={actionLoading}
                onClick={() => setShowRejectModal(true)}
                className="gap-1.5 text-xs !py-1.5 !px-3"
              >
                <XCircle className="w-3.5 h-3.5" />
                Tolak
              </Button>
              <Button
                variant="primary"
                disabled={actionLoading}
                onClick={() => handleApproval("APPROVE")}
                className="gap-1.5 text-xs !py-1.5 !px-3 !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Setujui (Approve)
              </Button>
            </>
          )}

          {pr.status === "DRAFT" && isOwner && (
            <Button
              variant="danger"
              disabled={actionLoading}
              onClick={handleDeletePR}
              className="gap-1.5 text-xs !py-1.5 !px-3"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Draft
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => window.print()}
            className="gap-1.5 text-xs !py-1.5 !px-3"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak PR
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Approval Status & Workflow Banner */}
      {pr.status === "PENDING_APPROVAL" && (
        <Card bodyClassName="!p-5 border-amber-200 bg-amber-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  Menunggu Persetujuan Internal Departemen
                </h3>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Permintaan ini membutuhkan persetujuan dari Supervisor / Manager departemen{" "}
                  <strong>{pr.department}</strong> sebelum dapat diproses lebih lanjut oleh Purchasing.
                </p>
                {currentUser?.role === "DEPT_APPROVER" && !isApproverUser && (
                  <p className="text-[11px] text-amber-900 bg-amber-100/80 px-2 py-1 rounded border border-amber-200 mt-2">
                    Akun Anda memiliki wewenang untuk: {currentUser.departments?.join(", ") || "—"}. Departemen PR ini ({pr.department}) di luar wewenang Anda.
                  </p>
                )}
              </div>
            </div>

            {isApproverUser && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="danger"
                  disabled={actionLoading}
                  onClick={() => setShowRejectModal(true)}
                  className="gap-1.5 text-xs !py-1.5 !px-3"
                >
                  <XCircle className="w-4 h-4" />
                  Tolak (Reject)
                </Button>
                <Button
                  variant="primary"
                  disabled={actionLoading}
                  onClick={() => handleApproval("APPROVE")}
                  className="gap-1.5 text-xs !py-1.5 !px-3 !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Setujui (Approve)
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Visual Lifecycle Stepper: Progress PR Dari Awal Sampai Selesai */}
      <Card bodyClassName="!p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Alur Siklus &amp; Progres Pengadaan PR</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau tahapan proses dari pengajuan PR, approval PO L1/L2, status kirim vendor, hingga penerimaan gudang
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              Status: {cfg.label}
            </span>
          </div>
        </div>

        {/* Stepper Grid (Horizontal Scroll di Layar Kecil, Grid Rapi di Layar Luas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 pt-1">
          {lifecycleSteps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = s.status === "COMPLETED";
            const isCurrent = s.status === "CURRENT";
            const isPartial = s.status === "PARTIAL";
            const isRejected = s.status === "REJECTED";

            return (
              <div
                key={s.stepNumber}
                className={`relative p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                  isCompleted
                    ? "border-emerald-200 bg-emerald-50/40"
                    : isCurrent
                    ? "border-amber-300 bg-amber-50/50 shadow-xs ring-1 ring-amber-200"
                    : isPartial
                    ? "border-blue-200 bg-blue-50/40"
                    : isRejected
                    ? "border-rose-200 bg-rose-50/40"
                    : "border-slate-200 bg-slate-50/60 opacity-80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCompleted
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-amber-500 text-white animate-pulse"
                          : isPartial
                          ? "bg-blue-600 text-white"
                          : isRejected
                          ? "bg-rose-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : isRejected ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        s.stepNumber
                      )}
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-800"
                          : isCurrent
                          ? "bg-amber-100 text-amber-800"
                          : isPartial
                          ? "bg-blue-100 text-blue-800"
                          : isRejected
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.badgeText}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{s.title}</span>
                  </h3>

                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2" title={s.summary}>
                    {s.summary}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400">
                  {s.timestamp ? (
                    <span>
                      {new Date(s.timestamp).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Ringkasan Progres Pemenuhan Kebutuhan (Fulfillment Progress Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Diminta</span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800">{totalQtyRequested}</span>
            <span className="text-[11px] text-slate-400">unit</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {pr.details.length} jenis item
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/30 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 text-xs">
            <span>Masuk PO</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-blue-900">{totalQtyOrdered}</span>
            <span className="text-[11px] text-blue-600">unit</span>
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">
            {percentOrdered}% ({totalQtyOrdered >= totalQtyRequested ? "Lengkap" : "Sebagian"})
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs">
            <span>Diterima Gudang</span>
            <PackageCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-900">{totalQtyReceived}</span>
            <span className="text-[11px] text-emerald-600">unit</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {percentReceived}% ({totalQtyReceived >= totalQtyRequested ? "Tuntas" : "Parsial"})
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border shadow-xs ${
            totalQtyOutstanding > 0
              ? "border-amber-300 bg-amber-50/40"
              : "border-slate-200 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={totalQtyOutstanding > 0 ? "text-amber-800 font-medium" : "text-slate-500"}>
              Belum Tiba (Kurang)
            </span>
            <Clock
              className={`w-4 h-4 ${
                totalQtyOutstanding > 0 ? "text-amber-600" : "text-slate-400"
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-xl font-bold ${
                totalQtyOutstanding > 0 ? "text-amber-900" : "text-slate-700"
              }`}
            >
              {totalQtyOutstanding}
            </span>
            <span className="text-[11px] text-slate-500">unit</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalQtyOutstanding === 0 ? "Pemenuhan tuntas" : `${outstandingDetails.length} item belum lengkap`}
          </div>
        </div>
      </div>

      {/* Linked POs Info */}
      {linkedOrders.length > 0 && (
        <Card bodyClassName="!p-4 space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Purchase Order yang Terbit</h2>
            <span className="text-xs text-slate-500">
              {totalQtyOrdered >= totalQtyRequested ? "Seluruh item telah dibuatkan PO" : "Sebagian item telah dibuatkan PO"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {linkedOrders.map((po) => (
              <Link
                key={po.id}
                href={`/purchasing/purchase-orders/${po.id}`}
                className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition flex flex-col justify-between group space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono font-bold text-xs text-blue-900 group-hover:underline">
                      {po.poNumber}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Supplier: {po.supplier}</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-blue-500 shrink-0" />
                </div>

                <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Approval PO:</span>
                  {po.approvedL2 ? (
                    <span className="font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      ✓ Presdir L2
                    </span>
                  ) : po.approvedL1 ? (
                    <span className="font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      ✓ Manager L1
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      Draft PO
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Overview Grid */}
      <Card bodyClassName="!p-5">
        <div className="border-b border-slate-100 pb-3 mb-3">
          <h2 className="text-sm font-bold text-slate-800">Informasi Permohonan</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Departemen Pemohon:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-800 border border-slate-200 mt-1">
              {pr.department}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Diminta Oleh:</span>
            <span className="font-semibold text-slate-800 mt-1 block">
              {pr.requestedBy.name} (@{pr.requestedBy.username})
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Target Dibutuhkan:</span>
            <span className="font-semibold text-slate-800 mt-1 block">
              {pr.requiredDate
                ? new Date(pr.requiredDate).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Tingkat Urgensi:</span>
            <span
              className={`inline-flex items-center gap-1 font-bold mt-1 ${
                isUrgent ? "text-rose-600" : "text-slate-700"
              }`}
            >
              {isUrgent && <AlertTriangle className="w-3.5 h-3.5" />}
              {pr.urgency}
            </span>
          </div>
        </div>

        {(pr.purposeNotes || pr.attachmentUrl) && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {pr.purposeNotes && (
              <div>
                <span className="text-slate-400 font-medium block mb-1">Keperluan / Catatan:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                  {pr.purposeNotes}
                </p>
              </div>
            )}

            {pr.attachmentUrl && (
              <div>
                <span className="text-slate-400 font-medium block mb-1">Lampiran Dokumen / Foto:</span>
                <a
                  href={pr.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline bg-blue-50/70 p-2.5 rounded-lg border border-blue-100 font-medium break-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Buka Tautan Lampiran
                </a>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Kartu Khusus: Barang yang Masih Kurang (Outstanding Items) */}
      {outstandingDetails.length > 0 &&
        ["APPROVED", "PARTIAL_PO", "ORDERED", "PARTIAL_RECEIVED"].includes(pr.status) && (
          <Card bodyClassName="!p-5 border-amber-200 bg-amber-50/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h3 className="text-sm font-bold text-amber-950">
                    Daftar Barang yang Masih Kurang ({outstandingDetails.length} Item)
                  </h3>
                  <span className="text-xs font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full self-start sm:self-auto">
                    Total Kekurangan: {totalQtyOutstanding} unit
                  </span>
                </div>
                <p className="text-xs text-amber-800/80 mt-1">
                  Item berikut masih menunggu pengiriman atau penerimaan di gudang agar kebutuhan terpenuhi lengkap:
                </p>

                <div className="mt-3.5 divide-y divide-amber-200/60 border border-amber-200 rounded-xl bg-white overflow-hidden shadow-xs">
                  {outstandingDetails.map((od) => {
                    const ordered = od.totalOrdered ?? od.orderedQty ?? 0;
                    const rec = od.totalReceived ?? 0;
                    const out = od.outstandingQty ?? Math.max(0, od.qty - rec);
                    const isCustom = !od.itemId;
                    const name = isCustom ? od.customItemName : od.item?.name;
                    const code = isCustom ? "Custom" : od.item?.code;

                    return (
                      <div
                        key={od.id}
                        className="p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:bg-amber-50/30"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-slate-700">
                              {code}
                            </span>
                            <span className="font-semibold text-slate-800">{name}</span>
                          </div>
                          {od.specifications && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Spek: {od.specifications}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                            <span>Diminta: <strong>{od.qty}</strong> {od.unit || "Pcs"}</span>
                            <span>•</span>
                            <span>Masuk PO: <strong>{ordered}</strong> {od.unit || "Pcs"}</span>
                            <span>•</span>
                            <span>Diterima Gudang: <strong className="text-emerald-700">{rec}</strong> {od.unit || "Pcs"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200">
                            Kurang {out} {od.unit || "Pcs"}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {ordered < od.qty
                              ? "Belum dibuatkan PO"
                              : rec > 0
                              ? "Menunggu sisa pengiriman"
                              : "Menunggu kirim supplier"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

      {/* Item List: Per-Item Tracking Progress */}
      <Card bodyClassName="!p-0">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Progress Setiap Barang yang Diminta</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian perjalanan status PO, approval L1/L2, surat jalan supplier, dan penerimaan gudang per item
            </p>
          </div>
          {!canSeePrice && (
            <div className="text-[11px] text-slate-400 italic">
              * Kolom harga dikhususkan untuk tim Purchasing. Admin memantau alur fisik &amp; status pengadaan.
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600">
              <tr>
                {(pr.status === "APPROVED" || pr.status === "PARTIAL_PO") && isPurchasingUser && (
                  <th className="px-3 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        pendingDetails.length > 0 &&
                        selectedDetailIds.length === pendingDetails.length
                      }
                      onChange={toggleSelectAllPending}
                      title="Pilih semua item pending"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-3 py-3 w-10 text-center">#</th>
                <th className="px-3 py-3">Nama Barang &amp; Part No</th>
                <th className="px-3 py-3 text-center">Qty Diminta</th>
                <th className="px-3 py-3">Status PO &amp; Approval</th>
                <th className="px-3 py-3">Pengiriman Vendor (Surat Jalan)</th>
                <th className="px-3 py-3">Penerimaan Gudang</th>
                <th className="px-3 py-3 text-center">Sisa (Kurang)</th>
                <th className="px-3 py-3">Satuan</th>
                {canSeePrice && <th className="px-3 py-3 text-right">Estimasi Harga</th>}
                <th className="px-3 py-3 text-center">Status Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pr.details.map((it, idx) => {
                const isCustom = !it.itemId;
                const ordered = it.totalOrdered ?? it.orderedQty ?? 0;
                const delivered = it.totalDelivered ?? 0;
                const received = it.totalReceived ?? 0;
                const outstanding = it.outstandingQty ?? Math.max(0, it.qty - received);
                const isFullyReceived = received >= it.qty && it.qty > 0;
                const isPartialReceived = received > 0 && received < it.qty;
                const isOrdered = ordered > 0 || (it.poDetails && it.poDetails.length > 0);
                const isSelected = selectedDetailIds.includes(it.id);

                // Kumpulkan informasi PO dari item ini
                const itemPos = (it.poDetails || []).map((p) => p.purchaseOrder);
                const firstPo = itemPos[0];
                const isPoL2 = itemPos.some((p) => Boolean(p.approvedL2At));
                const isPoL1 = itemPos.some((p) => Boolean(p.approvedAt));

                // Kumpulkan informasi Surat Jalan dari item ini
                const sjList: string[] = [];
                (it.poDetails || []).forEach((pod) => {
                  (pod.deliveryDetails || []).forEach((dd) => {
                    if (dd.delivery?.suratJalan && !sjList.includes(dd.delivery.suratJalan)) {
                      sjList.push(dd.delivery.suratJalan);
                    }
                  });
                });

                return (
                  <tr
                    key={it.id}
                    className={`transition-colors ${
                      isSelected ? "bg-blue-50/60 font-medium" : "hover:bg-slate-50/50"
                    }`}
                  >
                    {(pr.status === "APPROVED" || pr.status === "PARTIAL_PO") && isPurchasingUser && (
                      <td className="px-3 py-3 text-center">
                        {!isOrdered ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDetail(it.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    )}

                    <td className="px-3 py-3 text-center text-xs text-slate-400 font-mono">
                      {idx + 1}
                    </td>

                    {/* Nama Barang & Spesifikasi */}
                    <td className="px-3 py-3 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        {isCustom ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Sparkles className="w-2.5 h-2.5" />
                            Custom
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {it.item?.code}
                          </span>
                        )}
                        <span className="font-semibold text-slate-800 text-xs truncate">
                          {isCustom ? it.customItemName : it.item?.name}
                        </span>
                      </div>
                      {it.specifications && (
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={it.specifications}>
                          Spek: {it.specifications}
                        </div>
                      )}
                      {it.notes && (
                        <div className="text-[10px] text-slate-400 italic mt-0.5 truncate" title={it.notes}>
                          Ket: {it.notes}
                        </div>
                      )}
                    </td>

                    {/* Qty Diminta */}
                    <td className="px-3 py-3 text-center font-bold text-slate-800 text-xs">
                      {it.qty}
                    </td>

                    {/* Status PO & Approval */}
                    <td className="px-3 py-3">
                      {!isOrdered ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Belum PO
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-mono text-xs font-semibold text-blue-800">
                            <ShoppingBag className="w-3 h-3 text-blue-600" />
                            <span>{firstPo?.poNumber}</span>
                            <span className="text-slate-500 font-normal">({ordered} {it.unit || "Pcs"})</span>
                          </div>
                          <div>
                            {isPoL2 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Award className="w-2.5 h-2.5" />
                                Presdir (L2) Approved
                              </span>
                            ) : isPoL1 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <CheckSquare className="w-2.5 h-2.5" />
                                Manager (L1) Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-2.5 h-2.5" />
                                Menunggu Approval L1
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Pengiriman Vendor (Surat Jalan) */}
                    <td className="px-3 py-3">
                      {delivered === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Belum Dikirim
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <div>
                            {delivered >= it.qty ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Truck className="w-2.5 h-2.5" />
                                Terkirim Lengkap ({delivered} {it.unit || "Pcs"})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Truck className="w-2.5 h-2.5" />
                                Kirim Parsial ({delivered}/{it.qty})
                              </span>
                            )}
                          </div>
                          {sjList.length > 0 && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              SJ: {sjList.join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Penerimaan Gudang */}
                    <td className="px-3 py-3">
                      {received === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Belum Tiba
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <div>
                            {isFullyReceived ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Diterima Lengkap ({received} {it.unit || "Pcs"})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-2.5 h-2.5" />
                                Diterima Sebagian ({received}/{it.qty})
                              </span>
                            )}
                          </div>
                          {outstanding > 0 && (
                            <div className="text-[10px] text-rose-600 font-semibold">
                              Kurang: {outstanding} {it.unit || "Pcs"}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Sisa / Kurang */}
                    <td className="px-3 py-3 text-center text-xs">
                      {outstanding === 0 ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          Kurang {outstanding}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-slate-600 text-xs">
                      {it.unit || "Pcs"}
                    </td>

                    {/* Estimasi Harga (Hanya Purchasing) */}
                    {canSeePrice && (
                      <td className="px-3 py-3 text-right font-mono text-xs text-slate-700">
                        {it.estimatedPrice
                          ? `Rp ${Number(it.estimatedPrice).toLocaleString("id-ID")}`
                          : "—"}
                      </td>
                    )}

                    {/* Status Akhir */}
                    <td className="px-3 py-3 text-center">
                      {isFullyReceived ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Selesai
                        </span>
                      ) : isPartialReceived ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Parsial
                        </span>
                      ) : isOrdered ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          <ShoppingBag className="w-3 h-3" />
                          Proses PO
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Riwayat Logistik: Pengiriman & Penerimaan Gudang */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Riwayat Logistik: Pengiriman &amp; Penerimaan Barang
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau siapa yang mengirim dari pihak vendor dan siapa petugas gudang yang menerima barang
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sisi Kiri: Pengiriman Supplier (Delivery) */}
          <Card bodyClassName="!p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Pengiriman Supplier (Surat Jalan)
                  </h3>
                  <div className="text-[11px] text-slate-400">Total {deliveries.length} pengiriman</div>
                </div>
              </div>
            </div>

            {deliveries.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                <span>Belum ada surat jalan / catatan pengiriman dari supplier untuk PO terkait.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveries.map((del) => (
                  <div
                    key={del.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          SJ: {del.suratJalan}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          No. Pengiriman: <span className="font-mono">{del.deliveryNumber}</span> • PO:{" "}
                          <span className="font-mono text-blue-600">{del.poNumber}</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                        {del.status}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block">Dikirim Kapan:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(del.shipDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Dikirim Oleh:</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {del.supplier?.name || del.createdBy?.name || "Supplier"}
                        </span>
                      </div>
                    </div>

                    {del.details && del.details.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-1">
                          Item dalam Surat Jalan:
                        </span>
                        <div className="space-y-1">
                          {del.details.map((dit) => (
                            <div
                              key={dit.id}
                              className="flex items-center justify-between text-[11px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-100"
                            >
                              <span className="truncate pr-2">
                                {dit.item?.code ? `[${dit.item.code}] ` : ""}
                                {dit.item?.name || "Item"}
                              </span>
                              <span className="font-mono font-bold text-slate-900 shrink-0">
                                {dit.qty} {dit.item?.unit || "Pcs"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Sisi Kanan: Penerimaan Gudang (Warehouse Receiving) */}
          <Card bodyClassName="!p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <PackageCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Penerimaan di Gudang (Warehouse)
                  </h3>
                  <div className="text-[11px] text-slate-400">Total {receivings.length} tanda terima</div>
                </div>
              </div>
            </div>

            {receivings.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                <span>Belum ada barang yang diterima oleh tim Warehouse untuk PR ini.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {receivings.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          LPB: {rec.receivingNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Ref SJ: <span className="font-medium text-slate-700">{rec.delivery?.suratJalan || "—"}</span> • PO:{" "}
                          <span className="font-mono text-blue-600">{rec.poNumber}</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {rec.status}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block">Diterima Kapan:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(rec.receivedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Diterima Oleh (Gudang):</span>
                        <span className="font-semibold text-emerald-800 truncate block">
                          {rec.receivedBy?.name || "Petugas Warehouse"}
                          {rec.warehouse?.name ? ` (${rec.warehouse.name})` : ""}
                        </span>
                      </div>
                    </div>

                    {rec.details && rec.details.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-1">
                          Barang Fisik yang Diterima:
                        </span>
                        <div className="space-y-1">
                          {rec.details.map((rit) => (
                            <div
                              key={rit.id}
                              className="flex items-center justify-between text-[11px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-100"
                            >
                              <span className="truncate pr-2">
                                {rit.item?.code ? `[${rit.item.code}] ` : ""}
                                {rit.item?.name || "Item"}
                              </span>
                              <span className="font-mono font-bold text-emerald-700 shrink-0">
                                {rit.qtyReceived} {rit.item?.unit || "Pcs"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Floating Action Bar jika Purchasing memilih item untuk dibuatkan PO */}
      {isPurchasingUser && selectedDetailIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 sm:gap-6 border border-slate-700 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {selectedDetailIds.length}
            </div>
            <div>
              <div className="text-xs font-bold text-white">Item Terpilih Siap Masuk PO</div>
              <div className="text-[11px] text-slate-400">
                {selectedDetailIds.length} dari {pendingDetails.length} item pending
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDetailIds([])}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <Link
              href={`/purchasing/purchase-orders/new?prId=${pr.id}&detailIds=${selectedDetailIds.join(",")}`}
            >
              <Button
                variant="primary"
                className="!bg-blue-600 hover:!bg-blue-700 text-xs !py-1.5 !px-4 gap-1.5 shadow-md shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Buat PO ({selectedDetailIds.length} Item)
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <XCircle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">Tolak Purchase Request</h3>
            </div>
            <p className="text-xs text-slate-500">
              Berikan alasan penolakan agar admin departemen pemohon memahami perbaikan yang perlu
              dilakukan:
            </p>

            <textarea
              rows={3}
              placeholder="Contoh: Kuantiti terlalu besar, mohon diskusikan kebutuhan aktual minggu ini terlebih dahulu."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowRejectModal(false)}
                className="text-xs !py-1.5 !px-3 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                variant="danger"
                disabled={actionLoading || !rejectReason.trim()}
                onClick={() => handleApproval("REJECT")}
                className="text-xs !py-1.5 !px-3 cursor-pointer"
              >
                {actionLoading ? "Menolak..." : "Konfirmasi Penolakan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
