"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageTitle, Card, Badge, Button } from "@/components/ui";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  ShoppingBag,
  Check,
  X,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertCircle,
  Send,
} from "lucide-react";

type PRListItem = {
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
  requestedBy: { id: string; name: string; username: string };
  approvedBy?: { id: string; name: string } | null;
  rejectedBy?: { id: string; name: string } | null;
  details: Array<{
    id: string;
    qty: number;
    unit: string | null;
    customItemName: string | null;
    item?: { code: string; name: string; unit: string | null } | null;
    poDetails?: Array<{
      purchaseOrder: { id: string; poNumber: string; status: string };
    }>;
  }>;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeColor: "gray" | "blue" | "green" | "red" | "yellow" | "purple"; desc: string }
> = {
  DRAFT: { label: "Draft", badgeColor: "gray", desc: "Masih draft belum diajukan" },
  PENDING_APPROVAL: {
    label: "Menunggu Approval",
    badgeColor: "yellow",
    desc: "Menunggu persetujuan SPV/Manager Dept",
  },
  APPROVED: {
    label: "Disetujui (Siap PO)",
    badgeColor: "blue",
    desc: "Disetujui Dept, siap diproses Purchasing",
  },
  PARTIAL_PO: {
    label: "Sebagian Masuk PO",
    badgeColor: "blue",
    desc: "Sebagian item sudah diterbitkan PO",
  },
  ORDERED: {
    label: "Sudah PO (Menunggu Barang)",
    badgeColor: "purple",
    desc: "Semua item sudah dibuat PO, menunggu pengiriman",
  },
  PARTIAL_RECEIVED: {
    label: "Diterima Sebagian",
    badgeColor: "yellow",
    desc: "Sebagian barang sudah tiba di gudang",
  },
  COMPLETED: {
    label: "Selesai (Barang Diterima)",
    badgeColor: "green",
    desc: "Seluruh barang telah diterima lengkap di gudang",
  },
  CONVERTED: {
    label: "Sudah Jadi PO",
    badgeColor: "purple",
    desc: "Sudah diproses ke PO",
  },
  REJECTED: {
    label: "Ditolak",
    badgeColor: "red",
    desc: "Ditolak oleh SPV/Manager Dept",
  },
  CANCELLED: {
    label: "Dibatalkan",
    badgeColor: "gray",
    desc: "Dibatalkan oleh pemohon",
  },
};

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [prs, setPrs] = useState<PRListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState("ALL");
  const [scopeTab, setScopeTab] = useState<"ALL" | "MY_PENDING">("ALL");

  // Selection & Bulk Approval
  const [selectedPrIds, setSelectedPrIds] = useState<Set<string>>(new Set());
  const [actionLoadingPrId, setActionLoadingPrId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Modals
  const [approveModal, setApproveModal] = useState<{
    isOpen: boolean;
    isBulk: boolean;
    pr?: PRListItem;
  }>({ isOpen: false, isBulk: false });

  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    isBulk: boolean;
    pr?: PRListItem;
    reason: string;
  }>({ isOpen: false, isBulk: false, reason: "" });

  // Toast notification
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  async function loadData() {
    setLoading(true);
    try {
      const [resPr, resUser] = await Promise.all([
        fetch("/api/purchase-requests"),
        fetch("/api/user/profile").catch(() => null),
      ]);
      if (resPr.ok) {
        const data = await resPr.json();
        if (Array.isArray(data)) setPrs(data);
      }
      if (resUser && resUser.ok) {
        const u = await resUser.json();
        setCurrentUser(u);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Supervisor helpers
  const isSupervisor = currentUser?.role === "DEPT_APPROVER";
  const userDepts = useMemo(() => {
    return Array.isArray(currentUser?.departments) ? currentUser.departments : [];
  }, [currentUser]);

  // Apakah user berhak approve PR ini?
  const canApprovePr = (pr: PRListItem) => {
    return (
      isSupervisor &&
      pr.status === "PENDING_APPROVAL" &&
      userDepts.includes(pr.department)
    );
  };

  // Jumlah PR yang menunggu persetujuan supervisor login
  const myPendingCount = useMemo(() => {
    if (!isSupervisor) return 0;
    return prs.filter(canApprovePr).length;
  }, [prs, isSupervisor, userDepts]);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: prs.length,
      pending: prs.filter((p) => p.status === "PENDING_APPROVAL").length,
      approved: prs.filter((p) => p.status === "APPROVED").length,
      urgent: prs.filter(
        (p) => p.urgency === "URGENT" && !["COMPLETED", "CONVERTED", "CANCELLED"].includes(p.status)
      ).length,
      completed: prs.filter((p) => p.status === "COMPLETED" || p.status === "CONVERTED").length,
    };
  }, [prs]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    prs.forEach((p) => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set).sort();
  }, [prs]);

  // Filtered list
  const filtered = useMemo(() => {
    return prs.filter((p) => {
      if (scopeTab === "MY_PENDING" && !canApprovePr(p)) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (deptFilter !== "ALL" && p.department !== deptFilter) return false;
      if (urgencyFilter !== "ALL" && p.urgency !== urgencyFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNumber = p.prNumber.toLowerCase().includes(q);
        const matchDept = p.department.toLowerCase().includes(q);
        const matchPurpose = p.purposeNotes?.toLowerCase().includes(q);
        const matchRequester = p.requestedBy?.name?.toLowerCase().includes(q);
        const matchItems = p.details.some(
          (d) =>
            d.customItemName?.toLowerCase().includes(q) ||
            d.item?.name?.toLowerCase().includes(q) ||
            d.item?.code?.toLowerCase().includes(q)
        );
        if (!matchNumber && !matchDept && !matchPurpose && !matchRequester && !matchItems) {
          return false;
        }
      }
      return true;
    });
  }, [prs, scopeTab, statusFilter, deptFilter, urgencyFilter, search, isSupervisor, userDepts]);

  // List PR yang eligible untuk di-bulk approve dari hasil filter saat ini
  const eligibleInFiltered = useMemo(() => {
    return filtered.filter(canApprovePr);
  }, [filtered, isSupervisor, userDepts]);

  const allEligibleSelected =
    eligibleInFiltered.length > 0 &&
    eligibleInFiltered.every((p) => selectedPrIds.has(p.id));

  const someEligibleSelected =
    eligibleInFiltered.some((p) => selectedPrIds.has(p.id)) && !allEligibleSelected;

  // Toggle Single Selection
  const toggleSelectPr = (id: string) => {
    setSelectedPrIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle Select All Eligible
  const toggleSelectAllEligible = () => {
    if (allEligibleSelected) {
      setSelectedPrIds((prev) => {
        const next = new Set(prev);
        eligibleInFiltered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedPrIds((prev) => {
        const next = new Set(prev);
        eligibleInFiltered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  // Eksekusi Single Approve
  const handleSingleApprove = async (prId: string) => {
    setActionLoadingPrId(prId);
    try {
      const res = await fetch(`/api/purchase-requests/${prId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyetujui PR");
      }

      showToast("success", `Purchase Request berhasil disetujui!`);
      // Update local state instan
      setPrs((prev) =>
        prev.map((item) =>
          item.id === prId ? { ...item, status: "APPROVED", approvedBy: currentUser } : item
        )
      );
      setSelectedPrIds((prev) => {
        const next = new Set(prev);
        next.delete(prId);
        return next;
      });
      setApproveModal({ isOpen: false, isBulk: false });
    } catch (err: any) {
      showToast("error", err.message || "Terjadi kesalahan");
    } finally {
      setActionLoadingPrId(null);
    }
  };

  // Eksekusi Single Reject
  const handleSingleReject = async (prId: string, reason: string) => {
    if (!reason || reason.trim() === "") {
      showToast("error", "Alasan penolakan wajib diisi");
      return;
    }
    setActionLoadingPrId(prId);
    try {
      const res = await fetch(`/api/purchase-requests/${prId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "REJECT", reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menolak PR");
      }

      showToast("success", `Purchase Request telah ditolak.`);
      setPrs((prev) =>
        prev.map((item) =>
          item.id === prId ? { ...item, status: "REJECTED", rejectedBy: currentUser } : item
        )
      );
      setSelectedPrIds((prev) => {
        const next = new Set(prev);
        next.delete(prId);
        return next;
      });
      setRejectModal({ isOpen: false, isBulk: false, reason: "" });
    } catch (err: any) {
      showToast("error", err.message || "Terjadi kesalahan");
    } finally {
      setActionLoadingPrId(null);
    }
  };

  // Eksekusi Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedPrIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      const ids = Array.from(selectedPrIds);
      const res = await fetch(`/api/purchase-requests/batch-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prIds: ids, action: "APPROVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyetujui PR terpilih");
      }

      showToast("success", data.message || `Berhasil menyetujui ${ids.length} PR.`);
      const approvedSet = new Set(data.approvedIds || ids);
      setPrs((prev) =>
        prev.map((p) =>
          approvedSet.has(p.id) ? { ...p, status: "APPROVED", approvedBy: currentUser } : p
        )
      );
      setSelectedPrIds(new Set());
      setApproveModal({ isOpen: false, isBulk: false });
    } catch (err: any) {
      showToast("error", err.message || "Gagal batch approve");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Eksekusi Bulk Reject
  const handleBulkReject = async () => {
    if (selectedPrIds.size === 0) return;
    if (!rejectModal.reason || rejectModal.reason.trim() === "") {
      showToast("error", "Alasan penolakan wajib diisi");
      return;
    }
    setIsBatchProcessing(true);
    try {
      const ids = Array.from(selectedPrIds);
      const res = await fetch(`/api/purchase-requests/batch-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prIds: ids,
          action: "REJECT",
          reason: rejectModal.reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menolak PR terpilih");
      }

      showToast("success", data.message || `${ids.length} PR telah ditolak.`);
      const rejectedSet = new Set(data.rejectedIds || ids);
      setPrs((prev) =>
        prev.map((p) =>
          rejectedSet.has(p.id) ? { ...p, status: "REJECTED", rejectedBy: currentUser } : p
        )
      );
      setSelectedPrIds(new Set());
      setRejectModal({ isOpen: false, isBulk: false, reason: "" });
    } catch (err: any) {
      showToast("error", err.message || "Gagal batch reject");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const canCreatePR =
    !currentUser ||
    ["ADMIN_PRODUKSI", "ADMIN_INDIRECT", "PURCHASING", "DEPT_APPROVER"].includes(
      currentUser.role
    );

  // List PR terpilih untuk modal
  const selectedPrObjects = useMemo(() => {
    return prs.filter((p) => selectedPrIds.has(p.id));
  }, [prs, selectedPrIds]);

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notifikasi */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-top-3 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-400 hover:text-slate-600 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <PageTitle
        title="Purchase Requests (PR)"
        subtitle="Permintaan pembelian barang dari departemen untuk diproses oleh Purchasing"
        breadcrumb={["Purchasing", "Purchase Requests"]}
        action={
          canCreatePR ? (
            <Link href="/purchasing/purchase-requests/new">
              <Button variant="primary" className="gap-2 shadow-xs">
                <Plus className="w-4 h-4" />
                Buat PR Baru
              </Button>
            </Link>
          ) : null
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card bodyClassName="!p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total PR</p>
              <p className="text-2xl font-bold text-slate-800 mt-0.5">{stats.total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-4 border-amber-200/80 bg-amber-50/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 font-medium">Menunggu Approval</p>
              <p className="text-2xl font-bold text-amber-900 mt-0.5">{stats.pending}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">SPV / Manager Dept</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-4 border-blue-200/80 bg-blue-50/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium">Siap Diproses PO</p>
              <p className="text-2xl font-bold text-blue-900 mt-0.5">{stats.approved}</p>
              <p className="text-[10px] text-blue-600 mt-0.5">Antrean Purchasing</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-4 border-rose-200/80 bg-rose-50/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-700 font-medium">Kebutuhan Urgent</p>
              <p className="text-2xl font-bold text-rose-900 mt-0.5">{stats.urgent}</p>
              <p className="text-[10px] text-rose-600 mt-0.5">Prioritas tinggi</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-4 border-emerald-200/80 bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 font-medium">Selesai (Diterima)</p>
              <p className="text-2xl font-bold text-emerald-900 mt-0.5">{stats.completed}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Barang diterima lengkap</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Supervisor Focused Action Tabs */}
      {isSupervisor && (
        <div className="flex items-center gap-2 p-1 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/80">
          <button
            onClick={() => setScopeTab("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              scopeTab === "ALL"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Semua PR</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
              {prs.length}
            </span>
          </button>
          <button
            onClick={() => setScopeTab("MY_PENDING")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              scopeTab === "MY_PENDING"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-amber-800 hover:bg-amber-100/60"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Perlu Persetujuan Saya</span>
            {myPendingCount > 0 ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  scopeTab === "MY_PENDING"
                    ? "bg-amber-800 text-white"
                    : "bg-amber-200 text-amber-900 animate-pulse"
                }`}
              >
                {myPendingCount}
              </span>
            ) : (
              <span className="text-[10px] font-normal opacity-70">0</span>
            )}
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <Card bodyClassName="!p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No PR, Dept, Barang, atau Keperluan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Menunggu Approval</option>
              <option value="APPROVED">Disetujui (Siap PO)</option>
              <option value="PARTIAL_PO">Sebagian Masuk PO</option>
              <option value="ORDERED">Sudah PO (Menunggu Barang)</option>
              <option value="PARTIAL_RECEIVED">Diterima Sebagian</option>
              <option value="COMPLETED">Selesai (Barang Diterima)</option>
              <option value="REJECTED">Ditolak</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>

            {/* Department Filter */}
            {departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Semua Departemen</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}

            {/* Urgency Filter */}
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Semua Urgensi</option>
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent (Mendesak)</option>
            </select>

            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm">Memuat data Purchase Requests...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Tidak ada Purchase Request</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {scopeTab === "MY_PENDING"
                  ? "Semua Purchase Request dari departemen Anda sudah disetujui atau belum ada yang baru."
                  : search || statusFilter !== "ALL" || deptFilter !== "ALL"
                  ? "Tidak ada data PR yang cocok dengan kriteria filter."
                  : "Belum ada Purchase Request yang dibuat."}
              </p>
              {canCreatePR && (
                <Link href="/purchasing/purchase-requests/new" className="mt-4">
                  <Button variant="primary" className="gap-1.5 text-xs !py-1.5 !px-3">
                    <Plus className="w-3.5 h-3.5" />
                    Buat PR Sekarang
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/90 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  {/* Checkbox Column untuk Supervisor */}
                  {isSupervisor && (
                    <th className="w-10 px-3 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={allEligibleSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = someEligibleSelected;
                          }}
                          onChange={toggleSelectAllEligible}
                          disabled={eligibleInFiltered.length === 0}
                          title={
                            eligibleInFiltered.length > 0
                              ? "Pilih semua PR yang menunggu persetujuan Anda"
                              : "Tidak ada PR yang menunggu persetujuan Anda di halaman ini"
                          }
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                    </th>
                  )}
                  <th className="px-4 py-3">No PR &amp; Tanggal</th>
                  <th className="px-4 py-3">Departemen &amp; Pemohon</th>
                  <th className="px-4 py-3">Urgensi &amp; Target Dibutuhkan</th>
                  <th className="px-4 py-3">Rincian Kebutuhan</th>
                  <th className="px-4 py-3">Status PR</th>
                  <th className="px-4 py-3">Status PO</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((pr) => {
                  const cfg = STATUS_CONFIG[pr.status] || {
                    label: pr.status,
                    badgeColor: "gray",
                  };
                  const isUrgent = pr.urgency === "URGENT";
                  const isEligible = canApprovePr(pr);
                  const isSelected = selectedPrIds.has(pr.id);

                  // Check linked POs
                  const linkedPOs: Array<{ id: string; poNumber: string; status: string }> = [];
                  pr.details.forEach((d) => {
                    d.poDetails?.forEach((pod) => {
                      if (!linkedPOs.some((x) => x.id === pod.purchaseOrder.id)) {
                        linkedPOs.push(pod.purchaseOrder);
                      }
                    });
                  });

                  return (
                    <tr
                      key={pr.id}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? "bg-blue-50/70 hover:bg-blue-50"
                          : isEligible
                          ? "bg-amber-50/30 hover:bg-amber-50/60"
                          : "hover:bg-slate-50/70"
                      }`}
                      onClick={() => router.push(`/purchasing/purchase-requests/${pr.id}`)}
                    >
                      {/* Checkbox Cell */}
                      {isSupervisor && (
                        <td
                          className="px-3 py-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center">
                            {isEligible ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectPr(pr.id)}
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* No PR & Tanggal */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          {pr.prNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(pr.requestDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>

                      {/* Departemen & Pemohon */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {pr.department}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Oleh:{" "}
                          <span className="font-medium text-slate-700">
                            {pr.requestedBy?.name}
                          </span>
                        </div>
                      </td>

                      {/* Urgensi & Target */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isUrgent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              URGENT
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              Normal
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Target:{" "}
                          {pr.requiredDate
                            ? new Date(pr.requiredDate).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                      </td>

                      {/* Rincian Kebutuhan */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-medium text-slate-800 text-xs">
                          {pr.details.length} Item Kebutuhan
                        </div>
                        <div
                          className="text-[11px] text-slate-500 truncate mt-0.5"
                          title={pr.purposeNotes || ""}
                        >
                          {pr.purposeNotes || "—"}
                        </div>
                      </td>

                      {/* Status PR */}
                      <td className="px-4 py-3.5">
                        <Badge color={cfg.badgeColor}>{cfg.label}</Badge>
                        {isEligible && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 mt-1.5">
                            <Clock className="w-2.5 h-2.5 text-amber-700" />
                            <span>Perlu Approval Anda</span>
                          </div>
                        )}
                        {pr.status === "PENDING_APPROVAL" && !isEligible && (
                          <div className="text-[10px] text-amber-600 mt-1">
                            Menunggu SPV {pr.department}
                          </div>
                        )}
                        {pr.status === "APPROVED" && (
                          <div className="text-[10px] text-blue-600 mt-1">Siap Jadi PO</div>
                        )}
                      </td>

                      {/* Status PO */}
                      <td className="px-4 py-3.5">
                        {linkedPOs.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {linkedPOs.map((po) => (
                              <Link
                                key={po.id}
                                href={`/purchasing/purchase-orders/${po.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                {po.poNumber}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Belum ada PO</span>
                        )}
                      </td>

                      {/* Aksi Kolom */}
                      <td className="px-4 py-3.5 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Quick Inline Action untuk Supervisor */}
                          {isEligible && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoadingPrId === pr.id}
                                onClick={() =>
                                  setApproveModal({ isOpen: true, isBulk: false, pr })
                                }
                                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Langsung setujui PR ini"
                              >
                                {actionLoadingPrId === pr.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />
                                )}
                                <span>Setujui</span>
                              </button>

                              <button
                                type="button"
                                disabled={actionLoadingPrId === pr.id}
                                onClick={() =>
                                  setRejectModal({
                                    isOpen: true,
                                    isBulk: false,
                                    pr,
                                    reason: "",
                                  })
                                }
                                className="px-2 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                title="Tolak PR ini"
                              >
                                <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                                <span>Tolak</span>
                              </button>
                            </>
                          )}

                          <Link href={`/purchasing/purchase-requests/${pr.id}`}>
                            <button
                              type="button"
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detail
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Floating Bulk Action Bar */}
      {selectedPrIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md flex items-center gap-3.5 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-6 h-6 rounded-full bg-blue-500/30 text-blue-400 flex items-center justify-center text-xs font-bold font-mono">
              {selectedPrIds.size}
            </span>
            <span className="text-xs font-medium text-slate-200">PR Dipilih</span>
          </div>

          <button
            onClick={() => setApproveModal({ isOpen: true, isBulk: true })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Setujui Terpilih ({selectedPrIds.size})</span>
          </button>

          <button
            onClick={() => setRejectModal({ isOpen: true, isBulk: true, reason: "" })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold rounded-xl transition border border-rose-500/40 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Tolak Terpilih</span>
          </button>

          <button
            onClick={() => setSelectedPrIds(new Set())}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 transition cursor-pointer"
          >
            Batal
          </button>
        </div>
      )}

      {/* Modal Konfirmasi Persetujuan (Single & Bulk) */}
      {approveModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {approveModal.isBulk
                    ? `Setujui ${selectedPrIds.size} Purchase Request Sekaligus?`
                    : `Setujui Purchase Request ${approveModal.pr?.prNumber}?`}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Setelah disetujui, Purchase Request ini akan langsung diteruskan ke antrean
                  Purchasing untuk diterbitkan Purchase Order (PO).
                </p>
              </div>
            </div>

            {/* Ringkasan Daftar PR */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-52 overflow-y-auto space-y-2">
              {approveModal.isBulk ? (
                selectedPrObjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs py-1 px-1 border-b border-slate-100 last:border-b-0"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800">{p.prNumber}</span>
                      <span className="text-slate-500 ml-2">({p.department})</span>
                    </div>
                    <span className="text-slate-600 font-medium">
                      {p.details.length} item • {p.requestedBy.name}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nomor PR:</span>
                    <span className="font-mono font-bold">{approveModal.pr?.prNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Departemen:</span>
                    <span className="font-semibold">{approveModal.pr?.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pemohon:</span>
                    <span>{approveModal.pr?.requestedBy.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jumlah Item:</span>
                    <span className="font-bold">{approveModal.pr?.details.length} Item</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                disabled={isBatchProcessing || !!actionLoadingPrId}
                onClick={() => setApproveModal({ isOpen: false, isBulk: false })}
                className="text-xs !py-2 !px-3"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                disabled={isBatchProcessing || !!actionLoadingPrId}
                onClick={() => {
                  if (approveModal.isBulk) {
                    handleBulkApprove();
                  } else if (approveModal.pr) {
                    handleSingleApprove(approveModal.pr.id);
                  }
                }}
                className="gap-1.5 text-xs !py-2 !px-4 !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
              >
                {isBatchProcessing || !!actionLoadingPrId ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Ya, Setujui Sekarang</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Penolakan (Single & Bulk) */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {rejectModal.isBulk
                    ? `Tolak ${selectedPrIds.size} Purchase Request Terpilih?`
                    : `Tolak Purchase Request ${rejectModal.pr?.prNumber}?`}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Harap masukkan alasan penolakan agar pemohon dapat merevisi atau memahami
                  pembatalan permintaan.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Contoh: Spesifikasi belum jelas, budget departemen bulan ini tidak mencukupi, atau stok di gudang masih ada."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                disabled={isBatchProcessing || !!actionLoadingPrId}
                onClick={() =>
                  setRejectModal({ isOpen: false, isBulk: false, reason: "" })
                }
                className="text-xs !py-2 !px-3"
              >
                Batal
              </Button>
              <Button
                variant="danger"
                disabled={isBatchProcessing || !!actionLoadingPrId}
                onClick={() => {
                  if (rejectModal.isBulk) {
                    handleBulkReject();
                  } else if (rejectModal.pr) {
                    handleSingleReject(rejectModal.pr.id, rejectModal.reason);
                  }
                }}
                className="gap-1.5 text-xs !py-2 !px-4"
              >
                {isBatchProcessing || !!actionLoadingPrId ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                <span>Tolak PR</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
