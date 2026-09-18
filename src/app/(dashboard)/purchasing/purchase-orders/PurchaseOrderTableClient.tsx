"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Card, Badge, statusColor, EmptyState, Button } from "@/components/ui";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Warehouse as WarehouseIcon,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  Package,
  Truck,
  ArrowRight,
  Printer,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  LayoutList,
  PackageCheck,
  ExternalLink,
  Boxes,
  Check,
  ShieldCheck,
} from "lucide-react";

export const PO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Dikirim ke Supplier",
  WAITING_DELIVERY: "Menunggu Pengiriman",
  PARTIALLY_DELIVERED: "Terkirim Sebagian",
  WAITING_RECEIVING: "Menunggu Penerimaan",
  PARTIALLY_RECEIVED: "Diterima Sebagian",
  RECEIVED: "Diterima Penuh",
  CLOSED: "Closed",
  REVISED: "Direvisi",
  CANCELLED: "Dibatalkan (Cancelled)",
};

function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(d));
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export type POItem = {
  id: string;
  poNumber: string;
  revisionCount?: number;
  poDate: string | Date;
  status: string;
  notes?: string | null;
  approvedById?: string | null;
  approvedL2ById?: string | null;
  supplier: { name: string; code?: string };
  warehouse?: { name: string; code?: string } | null;
  deliveriesCount?: number;
  receivingsCount?: number;
  details: Array<{
    id?: string;
    qty: number;
    deliveredQty?: number;
    receivedQty: number;
    unitPrice?: number;
    item?: {
      id?: string;
      name: string;
      code: string;
      unit?: string | null;
      packageUnit?: string | null;
      packageSize?: number | null;
    } | null;
  }>;
};

type SortField = "poNumber" | "supplier" | "warehouse" | "poDate" | "progress" | "status";
type SortOrder = "asc" | "desc";

type MainView = "summary" | "detailed";
type DetailedSubView = "by-po" | "all-items";

export type POPaginationInfo = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

export type POKpis = {
  total: number;
  waiting: number;
  inProgress: number;
  completed: number;
};

export type POTabCounts = {
  pendingL1: number;
  approvedL1: number;
  pendingL2: number;
  approvedL2: number;
};

export type POActiveFilters = {
  search: string;
  status: string;
  tab: string;
  sort: string;
  order: string;
};

export default function PurchaseOrderTableClient({
  initialPOs,
  userApprovalLevel = 0,
  pagination = { page: 1, limit: 25, totalCount: initialPOs.length, totalPages: 1 },
  kpis: serverKpis,
  tabCounts: serverTabCounts,
  activeFilters = { search: "", status: "ALL", tab: "ALL", sort: "poDate", order: "desc" },
}: {
  initialPOs: POItem[];
  userApprovalLevel?: number;
  pagination?: POPaginationInfo;
  kpis?: POKpis;
  tabCounts?: POTabCounts;
  activeFilters?: POActiveFilters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [poList, setPoList] = useState<POItem[]>(initialPOs);
  const [deleteTarget, setDeleteTarget] = useState<POItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setPoList(initialPOs);
  }, [initialPOs]);

  // Views & Accordion states
  const [mainView, setMainView] = useState<MainView>("summary");
  const [detailedSubView, setDetailedSubView] = useState<DetailedSubView>("by-po");
  const [expandedPoIds, setExpandedPoIds] = useState<Set<string>>(new Set());
  const [expandedSummaryRows, setExpandedSummaryRows] = useState<Set<string>>(new Set());

  // Batch Approval states for Manager L1
  const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [batchApproveModalOpen, setBatchApproveModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search input state with debouncing
  const [searchInput, setSearchInput] = useState(activeFilters.search);

  useEffect(() => {
    setSearchInput(activeFilters.search);
  }, [activeFilters.search]);

  function updateQueryParams(updates: Record<string, string | number | null | undefined>) {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    for (const [key, value] of Object.entries(updates)) {
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        (key === "page" && Number(value) === 1) ||
        (key === "status" && value === "ALL") ||
        (key === "limit" && Number(value) === 25)
      ) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== activeFilters.search.trim()) {
        updateQueryParams({ search: searchInput.trim(), page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Approval counts from server
  const countPendingL1 = serverTabCounts?.pendingL1 ?? 0;
  const countApprovedL1 = serverTabCounts?.approvedL1 ?? 0;
  const countPendingL2 = serverTabCounts?.pendingL2 ?? 0;
  const countApprovedL2 = serverTabCounts?.approvedL2 ?? 0;

  // KPIs from server
  const kpis = serverKpis ?? {
    total: pagination.totalCount,
    waiting: 0,
    inProgress: 0,
    completed: 0,
  };

  // Database already filtered and sorted the rows!
  const sortedPOs = poList;

  const isApprover = userApprovalLevel === 1 || userApprovalLevel === 2;
  const isL2 = userApprovalLevel === 2;
  const isEnglish = isApprover;

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

  // PO yang eligible untuk approval di halaman saat ini (L1: Belum TTD L1, L2: Sudah L1 & Belum L2)
  const eligiblePOs = useMemo(() => {
    if (!isApprover) return [];
    if (userApprovalLevel === 1) {
      return sortedPOs.filter(
        (po) => !po.approvedById && po.status !== "CANCELLED"
      );
    }
    if (userApprovalLevel === 2) {
      return sortedPOs.filter(
        (po) => po.approvedById && !po.approvedL2ById && po.status !== "CANCELLED"
      );
    }
    return [];
  }, [sortedPOs, userApprovalLevel, isApprover]);

  const isAllEligibleSelected =
    eligiblePOs.length > 0 &&
    eligiblePOs.every((po) => selectedPoIds.has(po.id));

  const isSomeEligibleSelected =
    eligiblePOs.some((po) => selectedPoIds.has(po.id)) && !isAllEligibleSelected;

  const toggleSelectAll = () => {
    if (isAllEligibleSelected) {
      setSelectedPoIds(new Set());
    } else {
      setSelectedPoIds(new Set(eligiblePOs.map((p) => p.id)));
    }
  };

  const toggleSelectPo = (id: string) => {
    setSelectedPoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleBatchApprove() {
    if (selectedPoIds.size === 0) return;
    setIsBatchApproving(true);
    try {
      const res = await fetch("/api/purchase-orders/batch-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poIds: Array.from(selectedPoIds),
          level: userApprovalLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || (isEnglish ? "Failed to approve Purchase Orders." : "Gagal menyetujui PO"));
        return;
      }

      const approvedSet = new Set(selectedPoIds);
      setPoList((prev) =>
        prev.map((po) => {
          if (!approvedSet.has(po.id)) return po;
          if (userApprovalLevel === 1) {
            return { ...po, approvedById: "approved-manager" };
          }
          if (userApprovalLevel === 2) {
            return { ...po, approvedL2ById: "approved-presdir" };
          }
          return po;
        })
      );
      setSelectedPoIds(new Set());
      setBatchApproveModalOpen(false);
      setSuccessToast(
        data.message ||
          (isEnglish
            ? `Successfully approved ${approvedSet.size} Purchase Orders.`
            : `Berhasil menyetujui ${approvedSet.size} Purchase Order.`)
      );
      router.refresh();
    } catch (err: any) {
      alert(err.message || (isEnglish ? "An error occurred while approving." : "Terjadi kesalahan saat memproses persetujuan PO."));
    } finally {
      setIsBatchApproving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus Purchase Order");
        setDeleting(false);
        return;
      }

      setPoList((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err: any) {
      setDeleteError(err?.message || "Terjadi kesalahan saat menghubungi server");
    } finally {
      setDeleting(false);
    }
  }

  function handleSort(field: SortField) {
    const currentSort = activeFilters.sort;
    const currentOrder = activeFilters.order;
    const nextOrder = currentSort === field && currentOrder === "asc" ? "desc" : "asc";
    updateQueryParams({ sort: field, order: nextOrder, page: 1 });
  }

  // Pagination navigation helpers
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;
  const totalCount = pagination.totalCount;
  const currentLimit = pagination.limit;

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    updateQueryParams({ page: newPage });
  }

  function handleLimitChange(newLimit: number) {
    updateQueryParams({ limit: newLimit, page: 1 });
  }

  function renderPaginationControls() {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            {isEnglish ? "Showing " : "Menampilkan "}
            <strong className="text-slate-800 font-semibold">
              {totalCount === 0 ? 0 : (currentPage - 1) * currentLimit + 1} -{" "}
              {Math.min(currentPage * currentLimit, totalCount)}
            </strong>{" "}
            {isEnglish ? "of " : "dari "}
            <strong className="text-slate-900 font-bold">
              {totalCount.toLocaleString(isEnglish ? "en-US" : "id-ID")}
            </strong>{" "}
            {isEnglish ? "Purchase Orders" : "Purchase Order"}
          </span>

          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <span className="text-[11px] text-slate-400">{isEnglish ? "Show:" : "Tampilkan:"}</span>
            <select
              value={currentLimit}
              disabled={isPending}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value={10}>10 {isEnglish ? "/ page" : "/ hal"}</option>
              <option value={25}>25 {isEnglish ? "/ page" : "/ hal"}</option>
              <option value={50}>50 {isEnglish ? "/ page" : "/ hal"}</option>
              <option value={100}>100 {isEnglish ? "/ page" : "/ hal"}</option>
            </select>
          </div>

          {isPending && (
            <span className="flex items-center gap-1.5 text-blue-600 font-medium animate-pulse pl-2 border-l border-slate-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{isEnglish ? "Loading..." : "Memuat..."}</span>
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1 || isPending}
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-2xs cursor-pointer"
          >
            {isEnglish ? "‹ Previous" : "‹ Sebelumnya"}
          </button>

          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400 select-none">
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                disabled={isPending}
                onClick={() => handlePageChange(p as number)}
                className={`min-w-8 h-8 px-2 flex items-center justify-center text-xs rounded-lg transition-colors cursor-pointer ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-medium"
                }`}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            disabled={currentPage >= totalPages || isPending}
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-2xs cursor-pointer"
          >
            {isEnglish ? "Next ›" : "Berikutnya ›"}
          </button>
        </div>
      </div>
    );
  }

  // Overall Statistics across filtered POs
  const aggregatedStats = useMemo(() => {
    let totalItemsCount = 0;
    let totalQtyAll = 0;
    let totalDeliveredAll = 0;
    let totalReceivedAll = 0;

    for (const po of sortedPOs) {
      for (const d of po.details) {
        totalItemsCount += 1;
        totalQtyAll += d.qty;
        totalDeliveredAll += d.deliveredQty || 0;
        totalReceivedAll += d.receivedQty || 0;
      }
    }

    const totalOutstandingAll = Math.max(0, totalQtyAll - totalReceivedAll);
    const overallPercentage =
      totalQtyAll > 0 ? Math.min(100, Math.round((totalReceivedAll / totalQtyAll) * 100)) : 0;

    return {
      totalItemsCount,
      totalQtyAll,
      totalDeliveredAll,
      totalReceivedAll,
      totalOutstandingAll,
      overallPercentage,
    };
  }, [sortedPOs]);

  // Flat list of all items for "all-items" sub-view
  const allFlatItems = useMemo(() => {
    const list: Array<{
      poId: string;
      poNumber: string;
      poDate: string | Date;
      poStatus: string;
      supplierName: string;
      supplierCode?: string;
      warehouseName?: string;
      detailId?: string;
      qty: number;
      deliveredQty: number;
      receivedQty: number;
      outstandingQty: number;
      percent: number;
      unitPrice?: number;
      item: {
        name: string;
        code: string;
        unit?: string | null;
        packageUnit?: string | null;
        packageSize?: number | null;
      };
    }> = [];

    for (const po of sortedPOs) {
      for (const d of po.details) {
        if (!d.item) continue;
        const sisa = Math.max(0, d.qty - d.receivedQty);
        const pct = d.qty > 0 ? Math.min(100, Math.round((d.receivedQty / d.qty) * 100)) : 0;

        // If search exists, only show matching items if query matches item name or code
        const q = (activeFilters.search || "").toLowerCase().trim();
        if (q) {
          const matchNumber = po.poNumber.toLowerCase().includes(q);
          const matchSupplier = po.supplier.name.toLowerCase().includes(q) || (po.supplier.code?.toLowerCase().includes(q) ?? false);
          const matchWarehouse = po.warehouse?.name?.toLowerCase().includes(q) ?? false;
          const matchItem = d.item.name.toLowerCase().includes(q) || d.item.code.toLowerCase().includes(q);
          if (!matchNumber && !matchSupplier && !matchWarehouse && !matchItem) {
            continue;
          }
        }

        list.push({
          poId: po.id,
          poNumber: po.poNumber,
          poDate: po.poDate,
          poStatus: po.status,
          supplierName: po.supplier.name,
          supplierCode: po.supplier.code,
          warehouseName: po.warehouse?.name,
          detailId: d.id,
          qty: d.qty,
          deliveredQty: d.deliveredQty || 0,
          receivedQty: d.receivedQty || 0,
          outstandingQty: sisa,
          percent: pct,
          unitPrice: d.unitPrice,
          item: d.item,
        });
      }
    }
    return list;
  }, [sortedPOs, activeFilters.search]);

  // Accordion helpers for Detailed Per-PO mode
  const togglePoCard = (poId: string) => {
    setExpandedPoIds((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  const expandAllCards = () => {
    setExpandedPoIds(new Set(sortedPOs.map((p) => p.id)));
  };

  const collapseAllCards = () => {
    setExpandedPoIds(new Set());
  };

  // Accordion helper for Summary Row inline expand
  const toggleSummaryRow = (poId: string) => {
    setExpandedSummaryRows((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  // Initial expand when switching to detailed view
  const handleSwitchToDetailed = () => {
    setMainView("detailed");
    if (expandedPoIds.size === 0) {
      setExpandedPoIds(new Set(sortedPOs.map((p) => p.id)));
    }
  };

  function renderSortIcon(field: SortField) {
    if (activeFilters.sort !== field) return <ArrowUpDown size={12} className="opacity-30 text-slate-400" />;
    return activeFilters.order === "asc" ? (
      <ArrowUp size={12} className="text-blue-600 stroke-[2.5]" />
    ) : (
      <ArrowDown size={12} className="text-blue-600 stroke-[2.5]" />
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {[
          {
            key: "ALL",
            label: isEnglish ? "Total Purchase Orders" : "Total Purchase Order",
            value: kpis.total,
            icon: FileText,
            color: "text-indigo-600 bg-indigo-50 border-indigo-100",
            activeRing: "ring-2 ring-indigo-500/30 border-indigo-300",
            sub: isEnglish ? "All registered POs" : "Seluruh PO terdaftar",
          },
          {
            key: "WAITING_GROUP",
            label: isEnglish ? "Awaiting Delivery" : "Menunggu Pengiriman",
            value: kpis.waiting,
            icon: Clock,
            color: "text-amber-600 bg-amber-50 border-amber-100",
            activeRing: "ring-2 ring-amber-500/30 border-amber-300",
            sub: isEnglish ? "Awaiting supplier fulfillment" : "Menunggu respon supplier",
          },
          {
            key: "PROGRESS_GROUP",
            label: isEnglish ? "In Progress" : "Proses Penerimaan",
            value: kpis.inProgress,
            icon: Truck,
            color: "text-blue-600 bg-blue-50 border-blue-100",
            activeRing: "ring-2 ring-blue-500/30 border-blue-300",
            sub: isEnglish ? "Shipped / partially received" : "Terkirim / diterima sebagian",
          },
          {
            key: "COMPLETED_GROUP",
            label: isEnglish ? "Closed" : "Closed",
            value: kpis.completed,
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50 border-emerald-100",
            activeRing: "ring-2 ring-emerald-500/30 border-emerald-300",
            sub: isEnglish ? "Completed deliveries" : "Penerimaan tuntas",
          },
        ].map((k) => {
          const isSelected =
            activeFilters.status === k.key ||
            (k.key === "ALL" && (!activeFilters.status || activeFilters.status === "ALL"));
          const IconComp = k.icon;
          return (
            <div
              key={k.key}
              onClick={() => {
                const nextStatus = isSelected && k.key !== "ALL" ? "ALL" : k.key;
                updateQueryParams({ status: nextStatus, page: 1 });
              }}
              className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all duration-150 hover:shadow-sm ${
                isSelected ? k.activeRing : "border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">{k.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{k.value.toLocaleString(isEnglish ? "en-US" : "id-ID")}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${k.color}`}>
                  <IconComp className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* VIEW SWITCHER & FILTER CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
        {/* Top bar: Mode Switcher Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                {isEnglish ? "Purchase Orders Data View" : "Tampilan Data Purchase Order"}
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">
                {isEnglish ? "Choose PO summary or detailed item progress view" : "Pilih mode ringkasan atau detail rincian barang"}
              </span>
            </div>
          </div>

          {/* Primary View Switcher: Ringkasan PO vs Detail PO & Progres */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 self-start md:self-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setMainView("summary")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mainView === "summary"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span>{isEnglish ? "PO Summary" : "Ringkasan PO"}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  mainView === "summary"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {totalCount.toLocaleString(isEnglish ? "en-US" : "id-ID")}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSwitchToDetailed}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mainView === "detailed"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              <span>{isEnglish ? "PO Details & Progress" : "Detail PO & Progres"}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  mainView === "detailed"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {aggregatedStats.totalItemsCount} {isEnglish ? "Items (this page)" : "Barang (hal ini)"}
              </span>
            </button>
          </div>
        </div>

        {/* Approval Filter Tabs for Manager Purchasing */}
        {userApprovalLevel === 1 && (
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 mb-3">
            <span className="text-xs font-bold text-slate-700 px-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              {isEnglish ? "Purchasing Manager Approval:" : "Filter Approval Manager:"}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                updateQueryParams({ tab: "PENDING_L1", status: "ALL", page: 1 });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeFilters.tab === "PENDING_L1"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60"
              }`}
            >
              {isEnglish ? `Pending Approval (${countPendingL1})` : `Belum Di-TTD (${countPendingL1})`}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                updateQueryParams({ tab: "APPROVED_L1", status: "ALL", page: 1 });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilters.tab === "APPROVED_L1"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60"
              }`}
            >
              {isEnglish ? `Approved (${countApprovedL1})` : `Sudah Di-TTD (${countApprovedL1})`}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                updateQueryParams({ tab: "ALL", status: "ALL", page: 1 });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilters.tab === "ALL"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60"
              }`}
            >
              {isEnglish ? `All Purchase Orders (${kpis.total.toLocaleString("en-US")})` : `Semua PO (${kpis.total.toLocaleString("id-ID")})`}
            </button>
          </div>
        )}

        {/* Approval Filter Tabs for Presdir (Full English) */}
        {userApprovalLevel === 2 && (
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 mb-3">
            <span className="text-xs font-bold text-slate-700 px-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              President Director Approval:
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                updateQueryParams({ tab: "PENDING_L2", status: "ALL", page: 1 });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeFilters.tab === "PENDING_L2"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60"
              }`}
            >
              Pending Approval ({countPendingL2})
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                updateQueryParams({ tab: "APPROVED_L2", status: "ALL", page: 1 });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilters.tab === "APPROVED_L2"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60"
              }`}
            >
              Approved ({countApprovedL2})
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                updateQueryParams({ tab: "ALL", status: "ALL", page: 1 });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilters.tab === "ALL"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60"
              }`}
            >
              All Verified POs ({kpis.total.toLocaleString("en-US")})
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={isEnglish ? "Search PO Number, Supplier, item name (e.g. T-2609), Warehouse..." : "Cari No. PO, Supplier, nama item (cth: T-2609), Gudang..."}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateQueryParams({ search: searchInput.trim(), page: 1 });
                }
              }}
              className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800 placeholder:text-slate-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateQueryParams({ search: "", page: 1 });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={activeFilters.status}
              disabled={isPending}
              onChange={(e) => updateQueryParams({ status: e.target.value, page: 1 })}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-700 font-medium shadow-xs cursor-pointer"
            >
              <option value="ALL">{isEnglish ? `All Status (${kpis.total.toLocaleString("en-US")})` : `Semua Status (${kpis.total.toLocaleString("id-ID")})`}</option>
              <option value="WAITING_GROUP">{isEnglish ? `Awaiting Delivery (${kpis.waiting.toLocaleString("en-US")})` : `Menunggu Pengiriman (${kpis.waiting.toLocaleString("id-ID")})`}</option>
              <option value="PROGRESS_GROUP">{isEnglish ? `In Progress (${kpis.inProgress.toLocaleString("en-US")})` : `Proses Penerimaan (${kpis.inProgress.toLocaleString("id-ID")})`}</option>
              <option value="COMPLETED_GROUP">{isEnglish ? `Closed (${kpis.completed.toLocaleString("en-US")})` : `Closed (${kpis.completed.toLocaleString("id-ID")})`}</option>
              <option disabled>──────────</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">{isEnglish ? "Sent (Sent to Supplier)" : "Sent (Dikirim ke Supplier)"}</option>
              <option value="WAITING_DELIVERY">Waiting Delivery</option>
              <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
              <option value="WAITING_RECEIVING">Waiting Receiving</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">{isEnglish ? "Received (Fully Received)" : "Received (Diterima Penuh)"}</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">{isEnglish ? "Cancelled" : "Dibatalkan (Cancelled)"}</option>
            </select>
            {(activeFilters.search || activeFilters.status !== "ALL" || (userApprovalLevel > 0 && activeFilters.tab !== "ALL")) && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setSearchInput("");
                  updateQueryParams({
                    search: "",
                    status: "ALL",
                    tab: userApprovalLevel === 1 ? "PENDING_L1" : userApprovalLevel === 2 ? "PENDING_L2" : "ALL",
                    page: 1,
                  });
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Secondary Bar in Detailed Mode: Sub-views & Quick Stats */}
        {mainView === "detailed" && (
          <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60 -mx-4 -mb-4 p-4 rounded-b-2xl">
            {/* Sub-view switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">{isEnglish ? "View Mode:" : "Mode Tampilan:"}</span>
              <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDetailedSubView("by-po")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    detailedSubView === "by-po"
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  {isEnglish ? "By PO Cards" : "Per PO (Panel Barang)"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailedSubView("all-items")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    detailedSubView === "all-items"
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {isEnglish ? `All Items Flat List (${allFlatItems.length} Rows)` : `Rekap Seluruh Item (${allFlatItems.length} Baris)`}
                </button>
              </div>

              {detailedSubView === "by-po" && (
                <div className="flex items-center gap-2 ml-2">
                  <button
                    type="button"
                    onClick={expandAllCards}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                  >
                    {isEnglish ? "Expand All" : "Buka Semua"}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={collapseAllCards}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  >
                    {isEnglish ? "Collapse All" : "Tutup Semua"}
                  </button>
                </div>
              )}
            </div>

            {/* Quick KPI stats chips */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200/80 rounded-lg text-slate-700">
                <span className="text-slate-400">{isEnglish ? "Total Ordered:" : "Total Dipesan:"}</span>
                <strong className="font-semibold">{aggregatedStats.totalQtyAll.toLocaleString(isEnglish ? "en-US" : "id-ID")}</strong>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-lg text-emerald-800">
                <span className="text-emerald-600">{isEnglish ? "Received:" : "Diterima:"}</span>
                <strong className="font-bold">{aggregatedStats.totalReceivedAll.toLocaleString(isEnglish ? "en-US" : "id-ID")}</strong>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200/80 rounded-lg text-amber-900">
                <span className="text-amber-600">{isEnglish ? "Outstanding:" : "Sisa Fisik:"}</span>
                <strong className="font-bold">{aggregatedStats.totalOutstandingAll.toLocaleString(isEnglish ? "en-US" : "id-ID")}</strong>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/80 rounded-lg text-blue-800">
                <span className="text-blue-600">{isEnglish ? "Fulfillment:" : "Realisasi:"}</span>
                <strong className="font-bold">{aggregatedStats.overallPercentage}%</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: RINGKASAN PO (VIEW STANDAR YANG SEKARANG + INLINE EXPAND)         */}
      {/* ========================================================================= */}
      {mainView === "summary" && (
        <Card className="overflow-hidden border border-slate-200/80 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  {isApprover && (
                    <th className="w-10 px-3 py-3.5 text-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isAllEligibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeEligibleSelected;
                        }}
                        onChange={toggleSelectAll}
                        disabled={eligiblePOs.length === 0}
                        title={
                          eligiblePOs.length === 0
                            ? isEnglish
                              ? "No pending POs awaiting approval on this page"
                              : "Tidak ada PO yang belum di-TTD di halaman ini"
                            : isAllEligibleSelected
                            ? isEnglish
                              ? "Deselect all"
                              : "Batalkan pilihan semua"
                            : isEnglish
                            ? "Select all pending POs on this page"
                            : "Pilih semua PO yang belum di-TTD di halaman ini"
                        }
                        className={`w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-30 ${
                          isL2 ? "text-emerald-600 focus:ring-emerald-500" : "text-blue-600 focus:ring-blue-500"
                        }`}
                      />
                    </th>
                  )}
                  <th className="w-8 px-2 py-3.5 text-center"></th>
                  <th
                    onClick={() => handleSort("poNumber")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/60 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      {isEnglish ? "PO Number" : "No. PO"} {renderSortIcon("poNumber")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("supplier")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/60 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      {isEnglish ? "Supplier" : "Supplier"} {renderSortIcon("supplier")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("warehouse")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/60 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      {isEnglish ? "Destination Warehouse" : "Gudang Tujuan"} {renderSortIcon("warehouse")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("poDate")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/60 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      {isEnglish ? "PO Date" : "Tanggal PO"} {renderSortIcon("poDate")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("progress")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/60 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      {isEnglish ? "Item Progress" : "Progres Fisik"} {renderSortIcon("progress")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("status")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/60 transition-colors whitespace-nowrap text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {isEnglish ? "Status" : "Status PO"} {renderSortIcon("status")}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">{isEnglish ? "Action" : "Aksi"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPOs.map((po) => {
                  const totalQty = po.details.reduce((s, d) => s + d.qty, 0);
                  const receivedQty = po.details.reduce((s, d) => s + d.receivedQty, 0);
                  const percent = totalQty > 0 ? Math.min(100, Math.round((receivedQty / totalQty) * 100)) : 0;
                  const isClosed = po.status === "CLOSED";
                  const isExpanded = expandedSummaryRows.has(po.id);

                  return (
                    <tr key={po.id} className="group">
                      <td colSpan={isApprover ? 9 : 8} className="p-0">
                        <div
                          className={`flex items-center hover:bg-slate-50/60 transition-colors ${
                            isClosed ? "bg-slate-50/30" : ""
                          }`}
                        >
                          {/* Checkbox Kolom Approval (L1 & L2) */}
                          {isApprover && (
                            <div className="w-10 px-3 py-3.5 text-center shrink-0 flex items-center justify-center">
                              {userApprovalLevel === 1 ? (
                                !po.approvedById && po.status !== "CANCELLED" ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedPoIds.has(po.id)}
                                    onChange={() => toggleSelectPo(po.id)}
                                    aria-label={isEnglish ? `Select PO ${po.poNumber}` : `Pilih PO ${po.poNumber}`}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                  />
                                ) : po.approvedById ? (
                                  <span title={isEnglish ? "Approved by Purchasing Manager (L1)" : "Sudah disetujui Manager (L1)"}>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs font-mono">-</span>
                                )
                              ) : (
                                /* userApprovalLevel === 2 (Presdir L2) */
                                po.approvedById && !po.approvedL2ById && po.status !== "CANCELLED" ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedPoIds.has(po.id)}
                                    onChange={() => toggleSelectPo(po.id)}
                                    aria-label={`Select PO ${po.poNumber}`}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                                  />
                                ) : po.approvedL2ById ? (
                                  <span title="Approved by President Director (L2)">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  </span>
                                ) : !po.approvedById && po.status !== "CANCELLED" ? (
                                  <span
                                    className="px-1 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap"
                                    title="Waiting for Manager (L1) approval first"
                                  >
                                    Wait L1
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs font-mono">-</span>
                                )
                              )}
                            </div>
                          )}

                          {/* Toggle inline row chevron */}
                          <div className="w-8 px-2 py-3.5 text-center shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleSummaryRow(po.id)}
                              className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                              title={isExpanded ? (isEnglish ? "Collapse item details" : "Tutup rincian item") : (isEnglish ? "Expand item details" : "Buka rincian item di tempat")}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {/* No. PO */}
                          <div className="px-4 py-3.5 whitespace-nowrap min-w-[170px]">
                            <Link
                              href={`/purchasing/purchase-orders/${po.id}`}
                              className="inline-flex items-center gap-1.5 font-mono font-bold text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{po.poNumber}</span>
                              {po.revisionCount !== undefined && po.revisionCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold font-mono border border-amber-200">
                                  REV {String(po.revisionCount).padStart(2, "0")}
                                </span>
                              )}
                            </Link>
                            {po.notes && (
                              <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                                {po.notes}
                              </p>
                            )}
                          </div>

                          {/* Supplier */}
                          <div className="px-4 py-3.5 flex-1 min-w-[190px]">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800 text-sm">{po.supplier.name}</p>
                                {po.supplier.code && (
                                  <span className="font-mono text-[10px] text-slate-400">
                                    {po.supplier.code}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Warehouse */}
                          <div className="px-4 py-3.5 whitespace-nowrap min-w-[150px]">
                            <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                              <WarehouseIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              {po.warehouse?.name ?? "Pusat"}
                            </div>
                          </div>

                          {/* Tanggal PO */}
                          <div className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">
                            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatDateOnly(po.poDate)}
                            </div>
                          </div>

                          {/* Progress Fisik & Items */}
                          <div className="px-4 py-3.5 min-w-[220px] flex-1">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">
                                  {receivedQty.toLocaleString(isEnglish ? "en-US" : "id-ID")}{" "}
                                  <span className="font-normal text-slate-400">
                                    / {totalQty.toLocaleString(isEnglish ? "en-US" : "id-ID")}
                                  </span>
                                </span>
                                <span
                                  className={`font-mono text-[11px] font-bold ${
                                    percent === 100
                                      ? "text-emerald-600"
                                      : percent > 0
                                      ? "text-blue-600"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {percent}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    percent === 100
                                      ? "bg-emerald-500"
                                      : percent > 0
                                      ? "bg-blue-600"
                                      : "bg-slate-300"
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Status PO */}
                          <div className="px-4 py-3.5 text-center whitespace-nowrap min-w-[140px]">
                            <Badge color={statusColor(po.status)}>
                              {isEnglish ? (EN_STATUS_MAP[po.status] || po.status) : (PO_STATUS_LABEL[po.status] || po.status)}
                            </Badge>
                          </div>

                          {/* Aksi */}
                          <div className="px-4 py-3.5 text-right whitespace-nowrap min-w-[130px]">
                            <div className="flex items-center justify-end gap-1.5">
                              {userApprovalLevel === 0 && ["DRAFT", "CANCELLED"].includes(po.status) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleteTarget(po);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title={po.status === "CANCELLED" ? "Hapus PO yang Dibatalkan" : "Hapus PO (Draft)"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <Link
                                href={`/purchasing/purchase-orders/${po.id}/print`}
                                target="_blank"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                title={isEnglish ? "Print / Save PDF" : "Cetak / Simpan PDF"}
                              >
                                <Printer className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/purchasing/purchase-orders/${po.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                {isEnglish ? "Details" : "Detail"} <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        </div>

                        {/* Inline Expanded Items Table */}
                        {isExpanded && (
                          <div className="bg-slate-50/70 border-t border-b border-slate-200/80 px-8 py-4 animate-in fade-in duration-150">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                              <div className="px-4 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700">
                                  {isEnglish ? `Details for ${po.details.length} Items in PO ${po.poNumber}` : `Rincian ${po.details.length} Item pada PO ${po.poNumber}`}
                                </span>
                                <Link
                                  href={`/purchasing/purchase-orders/${po.id}`}
                                  className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] font-medium"
                                >
                                  {isEnglish ? "Open PO Details Page" : "Buka Halaman Detail PO"} <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                                  <tr>
                                    <th className="px-4 py-2.5 w-10 text-center">No</th>
                                    <th className="px-4 py-2.5">{isEnglish ? "Item" : "Barang (Item)"}</th>
                                    <th className="px-4 py-2.5 text-right">{isEnglish ? "PO Qty" : "Qty PO"}</th>
                                    <th className="px-4 py-2.5 text-right">{isEnglish ? "Shipped" : "Terkirim"}</th>
                                    <th className="px-4 py-2.5 text-right">{isEnglish ? "Received" : "Diterima"}</th>
                                    <th className="px-4 py-2.5 text-right">{isEnglish ? "Remaining" : "Sisa (Outstanding)"}</th>
                                    <th className="px-4 py-2.5 text-center">{isEnglish ? "Progress" : "Progres"}</th>
                                    <th className="px-4 py-2.5 text-center">{isEnglish ? "Status" : "Status Item"}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {po.details.map((d, dIdx) => {
                                    const pkgUnit = d.item?.packageUnit || "Pail";
                                    const pkgSize = Number(d.item?.packageSize ?? 1);
                                    const poPkgQty =
                                      pkgSize > 0 ? Math.ceil(d.qty / pkgSize) : d.qty;
                                    const recvPkgQty =
                                      pkgSize > 0 ? Math.floor(d.receivedQty / pkgSize) : d.receivedQty;
                                    const sisa = Math.max(0, d.qty - d.receivedQty);
                                    const sisaPkg =
                                      pkgSize > 0 ? Math.ceil(sisa / pkgSize) : sisa;
                                    const itemPct =
                                      d.qty > 0
                                        ? Math.min(100, Math.round((d.receivedQty / d.qty) * 100))
                                        : 0;

                                    let itemStatusBadge = { label: isEnglish ? "Waiting" : "Menunggu", color: "slate" as any };
                                    if (d.receivedQty >= d.qty && d.qty > 0) {
                                      itemStatusBadge = { label: isEnglish ? "Completed" : "Tuntas", color: "green" };
                                    } else if (d.receivedQty > 0) {
                                      itemStatusBadge = { label: isEnglish ? "Partially Received" : "Diterima Sebagian", color: "blue" };
                                    } else if ((d.deliveredQty || 0) > 0) {
                                      itemStatusBadge = { label: isEnglish ? "In Transit" : "Dalam Pengiriman", color: "amber" };
                                    }

                                    return (
                                      <tr key={d.id || dIdx} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2 text-center text-slate-400 font-mono">
                                          {dIdx + 1}
                                        </td>
                                        <td className="px-4 py-2">
                                          <div className="font-semibold text-slate-800">
                                            {d.item?.name || "Item tanpa nama"}
                                          </div>
                                          <div className="text-[11px] text-slate-400 font-mono">
                                            {d.item?.code} · Spek: 1 {pkgUnit} = {pkgSize}{" "}
                                            {d.item?.unit || "kg"}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap font-medium text-slate-800">
                                          <div>{d.qty} {d.item?.unit || "kg"}</div>
                                          <div className="text-[11px] text-slate-400 font-normal">
                                            ({poPkgQty} {pkgUnit})
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap text-slate-600">
                                          {d.deliveredQty || 0} {d.item?.unit || "kg"}
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap font-semibold text-emerald-600">
                                          <div>{d.receivedQty} {d.item?.unit || "kg"}</div>
                                          <div className="text-[11px] text-emerald-500 font-normal">
                                            ({recvPkgQty} {pkgUnit})
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap font-semibold">
                                          {sisa === 0 ? (
                                            <span className="text-emerald-600 flex items-center justify-end gap-1">
                                              <Check className="w-3.5 h-3.5" /> 0 {d.item?.unit || "kg"}
                                            </span>
                                          ) : (
                                            <div className="text-amber-600">
                                              <div>{sisa} {d.item?.unit || "kg"}</div>
                                              <div className="text-[11px] text-amber-500 font-normal">
                                                ({sisaPkg} {pkgUnit})
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-center min-w-[120px]">
                                          <div className="flex items-center gap-2 justify-center">
                                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full ${
                                                  itemPct === 100
                                                    ? "bg-emerald-500"
                                                    : itemPct > 0
                                                    ? "bg-blue-600"
                                                    : "bg-slate-200"
                                                }`}
                                                style={{ width: `${itemPct}%` }}
                                              />
                                            </div>
                                            <span className="font-mono text-[11px] font-bold text-slate-700">
                                              {itemPct}%
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <Badge color={itemStatusBadge.color}>
                                            {itemStatusBadge.label}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedPOs.length === 0 && (
            <div className="py-12 px-4 text-center">
              <EmptyState message="Tidak ada Purchase Order yang sesuai dengan pencarian atau filter yang dipilih." />
              {(activeFilters.search || activeFilters.status !== "ALL" || (userApprovalLevel > 0 && activeFilters.tab !== "ALL")) && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setSearchInput("");
                    updateQueryParams({
                      search: "",
                      status: "ALL",
                      tab: userApprovalLevel === 1 ? "PENDING_L1" : userApprovalLevel === 2 ? "PENDING_L2" : "ALL",
                      page: 1,
                    });
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                >
                  Tampilkan Semua Purchase Order
                </button>
              )}
            </div>
          )}

          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-medium">
            <span>
              Halaman <strong className="text-slate-800 font-bold">{currentPage}</strong> dari{" "}
              <strong className="text-slate-800 font-bold">{totalPages}</strong> (
              <strong className="text-slate-800">{sortedPOs.length}</strong> PO di halaman ini)
            </span>
            <div className="flex items-center gap-2">
              {activeFilters.tab !== "ALL" && (
                <span className="text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 text-[11px] font-semibold">
                  Filter: {
                    activeFilters.tab === "PENDING_L1"
                      ? "Belum Di-TTD Manager"
                      : activeFilters.tab === "APPROVED_L1"
                      ? "Sudah Di-TTD Manager"
                      : activeFilters.tab === "PENDING_L2"
                      ? "Menunggu TTD Presdir"
                      : "Disetujui Presdir"
                  }
                </span>
              )}
              {activeFilters.status !== "ALL" && (
                <span className="text-blue-600 font-semibold">
                  Status: {activeFilters.status.replace("_GROUP", "")}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DETAIL PO & PROGRES (MIRIP RIWAYAT PENGIRIMAN & PENERIMAAN)       */}
      {/* ========================================================================= */}
      {mainView === "detailed" && (
        <div className="space-y-4">
          {/* SUB-MODE A: PER PURCHASE ORDER (CARD + EXPANDABLE ITEM TABLE) */}
          {detailedSubView === "by-po" && (
            <div className="space-y-4">
              {sortedPOs.length === 0 ? (
                <Card className="py-12 px-4 text-center">
                  <EmptyState message="Tidak ada Purchase Order yang cocok dengan filter atau pencarian." />
                </Card>
              ) : (
                sortedPOs.map((po) => {
                  const totalQty = po.details.reduce((s, d) => s + d.qty, 0);
                  const receivedQty = po.details.reduce((s, d) => s + d.receivedQty, 0);
                  const deliveredQty = po.details.reduce((s, d) => s + (d.deliveredQty || 0), 0);
                  const outstandingQty = Math.max(0, totalQty - receivedQty);
                  const percent =
                    totalQty > 0 ? Math.min(100, Math.round((receivedQty / totalQty) * 100)) : 0;
                  const isExpanded = expandedPoIds.has(po.id);

                  return (
                    <div
                      key={po.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-150 hover:border-slate-300"
                    >
                      {/* PO Card Header */}
                      <div
                        onClick={() => togglePoCard(po.id)}
                        className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/80 to-white border-b border-slate-200/80 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 select-none hover:bg-slate-50/90 transition-colors"
                      >
                        {/* Left: PO identity, Supplier, Warehouse, Date */}
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-0.5 p-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 transition-colors shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/purchasing/purchase-orders/${po.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono font-bold text-base text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                              >
                                <FileText className="w-4 h-4 text-blue-500" />
                                <span>{po.poNumber}</span>
                                {po.revisionCount !== undefined && po.revisionCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold font-mono border border-amber-200">
                                    REV {String(po.revisionCount).padStart(2, "0")}
                                  </span>
                                )}
                              </Link>
                              <Badge color={statusColor(po.status)}>
                                {PO_STATUS_LABEL[po.status] || po.status}
                              </Badge>
                              {po.deliveriesCount !== undefined && po.deliveriesCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  <Truck className="w-3 h-3" />
                                  {po.deliveriesCount} Surat Jalan
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {po.supplier.name}
                                {po.supplier.code && (
                                  <span className="font-mono text-slate-400 text-[10px]">
                                    ({po.supplier.code})
                                  </span>
                                )}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-slate-600">
                                <WarehouseIcon className="w-3.5 h-3.5 text-amber-600" />
                                {po.warehouse?.name ?? "Pusat"}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-slate-500">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatDateOnly(po.poDate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Progress numbers, bar, and actions */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-between lg:justify-end gap-5 shrink-0"
                        >
                          {/* Progress summary widget */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-800">
                                <span className="text-emerald-600 font-extrabold">{receivedQty.toLocaleString("id-ID")}</span>
                                <span className="text-slate-400 font-normal"> / {totalQty.toLocaleString("id-ID")}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {outstandingQty > 0 ? (
                                  <span className="text-amber-600 font-medium">Sisa: {outstandingQty}</span>
                                ) : (
                                  <span className="text-emerald-600 font-medium">Tuntas</span>
                                )}
                              </div>
                            </div>

                            <div className="w-24">
                              <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
                                <span
                                  className={
                                    percent === 100
                                      ? "text-emerald-600"
                                      : percent > 0
                                      ? "text-blue-600"
                                      : "text-slate-400"
                                  }
                                >
                                  {percent}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    percent === 100
                                      ? "bg-emerald-500"
                                      : percent > 0
                                      ? "bg-blue-600"
                                      : "bg-slate-300"
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Quick Action buttons */}
                          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                            <Link
                              href={`/purchasing/purchase-orders/${po.id}/print`}
                              target="_blank"
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Cetak PDF"
                            >
                              <Printer className="w-4 h-4" />
                            </Link>

                            <Link
                              href={`/purchasing/purchase-orders/${po.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100/80 rounded-lg transition-colors"
                            >
                              Detail <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* PO Items Table (Visible when expanded) */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50/90 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 w-10 text-center">No</th>
                                <th className="px-4 py-3">Barang (Item) & Spek Kemasan</th>
                                <th className="px-4 py-3 text-right">Qty PO</th>
                                <th className="px-4 py-3 text-right">Terkirim (Surat Jalan)</th>
                                <th className="px-4 py-3 text-right">Diterima Gudang</th>
                                <th className="px-4 py-3 text-right">Sisa (Outstanding)</th>
                                <th className="px-4 py-3 text-center">Progres Fisik</th>
                                <th className="px-4 py-3 text-center">Status Item</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {po.details.map((d, dIdx) => {
                                const pkgUnit = d.item?.packageUnit || "Pail";
                                const pkgSize = Number(d.item?.packageSize ?? 1);
                                const poPkgQty =
                                  pkgSize > 0 ? Math.ceil(d.qty / pkgSize) : d.qty;
                                const recvPkgQty =
                                  pkgSize > 0 ? Math.floor(d.receivedQty / pkgSize) : d.receivedQty;
                                const sisa = Math.max(0, d.qty - d.receivedQty);
                                const sisaPkg =
                                  pkgSize > 0 ? Math.ceil(sisa / pkgSize) : sisa;
                                const itemPct =
                                  d.qty > 0
                                    ? Math.min(100, Math.round((d.receivedQty / d.qty) * 100))
                                    : 0;

                                let itemStatusBadge = { label: "Menunggu", color: "slate" as any };
                                if (d.receivedQty >= d.qty && d.qty > 0) {
                                  itemStatusBadge = { label: "Tuntas", color: "green" };
                                } else if (d.receivedQty > 0) {
                                  itemStatusBadge = { label: "Diterima Sebagian", color: "blue" };
                                } else if ((d.deliveredQty || 0) > 0) {
                                  itemStatusBadge = { label: "Dalam Pengiriman", color: "amber" };
                                }

                                return (
                                  <tr
                                    key={d.id || dIdx}
                                    className="hover:bg-blue-50/30 transition-colors"
                                  >
                                    <td className="px-4 py-3 text-center text-slate-400 font-mono">
                                      {dIdx + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-slate-900 text-sm">
                                        {d.item?.name || "Item tanpa nama"}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                        Kode: {d.item?.code} · Konversi: 1 {pkgUnit} = {pkgSize}{" "}
                                        {d.item?.unit || "kg"}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-slate-800">
                                      <div className="text-sm">{d.qty.toLocaleString("id-ID")} {d.item?.unit || "kg"}</div>
                                      <div className="text-[11px] text-slate-400">
                                        ({poPkgQty.toLocaleString("id-ID")} {pkgUnit})
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                                      <div className="text-sm">{(d.deliveredQty || 0).toLocaleString("id-ID")} {d.item?.unit || "kg"}</div>
                                      <div className="text-[11px] text-slate-400">
                                        surat jalan
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-emerald-600">
                                      <div className="text-sm">{d.receivedQty.toLocaleString("id-ID")} {d.item?.unit || "kg"}</div>
                                      <div className="text-[11px] text-emerald-500 font-normal">
                                        ({recvPkgQty.toLocaleString("id-ID")} {pkgUnit})
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold">
                                      {sisa === 0 ? (
                                        <span className="text-emerald-600 flex items-center justify-end gap-1 text-xs">
                                          <Check className="w-3.5 h-3.5" /> Lengkap
                                        </span>
                                      ) : (
                                        <div className="text-amber-600">
                                          <div className="text-sm">{sisa.toLocaleString("id-ID")} {d.item?.unit || "kg"}</div>
                                          <div className="text-[11px] text-amber-500 font-normal">
                                            ({sisaPkg.toLocaleString("id-ID")} {pkgUnit})
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center min-w-[140px]">
                                      <div className="flex items-center gap-2 justify-center">
                                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all ${
                                              itemPct === 100
                                                ? "bg-emerald-500"
                                                : itemPct > 0
                                                ? "bg-blue-600"
                                                : "bg-slate-200"
                                            }`}
                                            style={{ width: `${itemPct}%` }}
                                          />
                                        </div>
                                        <span className="font-mono text-xs font-bold text-slate-700">
                                          {itemPct}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                      <Badge color={itemStatusBadge.color}>
                                        {itemStatusBadge.label}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          {po.notes && (
                            <div className="px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
                              <span className="font-semibold text-slate-700">Catatan PO:</span>
                              <span>{po.notes}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SUB-MODE B: REKAPITULASI SELURUH ITEM (FLAT UNIFIED TABLE) */}
          {detailedSubView === "all-items" && (
            <Card className="overflow-hidden border border-slate-200 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-3 w-10 text-center">No</th>
                      <th className="px-3.5 py-3">No. PO</th>
                      <th className="px-3.5 py-3">Supplier & Gudang</th>
                      <th className="px-3.5 py-3">Tanggal PO</th>
                      <th className="px-3.5 py-3">Barang (Item) & Spek Kemasan</th>
                      <th className="px-3.5 py-3 text-right">Qty PO</th>
                      <th className="px-3.5 py-3 text-right">Terkirim</th>
                      <th className="px-3.5 py-3 text-right">Diterima</th>
                      <th className="px-3.5 py-3 text-right">Sisa</th>
                      <th className="px-3.5 py-3 text-center">Progres</th>
                      <th className="px-3.5 py-3 text-center">Status Item</th>
                      <th className="px-3.5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allFlatItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                          Tidak ada baris item yang sesuai dengan filter atau pencarian.
                        </td>
                      </tr>
                    ) : (
                      allFlatItems.map((row, idx) => {
                        const pkgUnit = row.item.packageUnit || "Pail";
                        const pkgSize = Number(row.item.packageSize ?? 1);
                        const poPkgQty =
                          pkgSize > 0 ? Math.ceil(row.qty / pkgSize) : row.qty;
                        const recvPkgQty =
                          pkgSize > 0 ? Math.floor(row.receivedQty / pkgSize) : row.receivedQty;
                        const sisaPkg =
                          pkgSize > 0 ? Math.ceil(row.outstandingQty / pkgSize) : row.outstandingQty;

                        let itemStatusBadge = { label: "Menunggu", color: "slate" as any };
                        if (row.receivedQty >= row.qty && row.qty > 0) {
                          itemStatusBadge = { label: "Tuntas", color: "green" };
                        } else if (row.receivedQty > 0) {
                          itemStatusBadge = { label: "Sebagian", color: "blue" };
                        } else if (row.deliveredQty > 0) {
                          itemStatusBadge = { label: "Dalam Kirim", color: "amber" };
                        }

                        return (
                          <tr key={`${row.poId}-${row.detailId || idx}`} className="hover:bg-blue-50/40 transition-colors">
                            <td className="px-3.5 py-3 text-center text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <Link
                                href={`/purchasing/purchase-orders/${row.poId}`}
                                className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              >
                                {row.poNumber}
                              </Link>
                              <Badge color={statusColor(row.poStatus)} className="mt-1 text-[10px]">
                                {PO_STATUS_LABEL[row.poStatus] || row.poStatus}
                              </Badge>
                            </td>
                            <td className="px-3.5 py-3">
                              <div className="font-semibold text-slate-800">{row.supplierName}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <WarehouseIcon className="w-3 h-3 text-amber-600" />
                                {row.warehouseName || "Pusat"}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 whitespace-nowrap text-slate-600">
                              {formatDateOnly(row.poDate)}
                            </td>
                            <td className="px-3.5 py-3">
                              <div className="font-semibold text-slate-900">{row.item.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {row.item.code} · Spek: 1 {pkgUnit} = {pkgSize} {row.item.unit || "kg"}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-right whitespace-nowrap font-medium text-slate-800">
                              <div>{row.qty.toLocaleString("id-ID")} {row.item.unit || "kg"}</div>
                              <div className="text-[11px] text-slate-400">({poPkgQty} {pkgUnit})</div>
                            </td>
                            <td className="px-3.5 py-3 text-right whitespace-nowrap text-slate-600">
                              <div>{row.deliveredQty.toLocaleString("id-ID")} {row.item.unit || "kg"}</div>
                            </td>
                            <td className="px-3.5 py-3 text-right whitespace-nowrap font-semibold text-emerald-600">
                              <div>{row.receivedQty.toLocaleString("id-ID")} {row.item.unit || "kg"}</div>
                              <div className="text-[11px] text-emerald-500 font-normal">({recvPkgQty} {pkgUnit})</div>
                            </td>
                            <td className="px-3.5 py-3 text-right whitespace-nowrap font-semibold">
                              {row.outstandingQty === 0 ? (
                                <span className="text-emerald-600 flex items-center justify-end gap-1">
                                  <Check className="w-3 h-3" /> Lengkap
                                </span>
                              ) : (
                                <div className="text-amber-600">
                                  <div>{row.outstandingQty.toLocaleString("id-ID")} {row.item.unit || "kg"}</div>
                                  <div className="text-[11px] text-amber-500 font-normal">({sisaPkg} {pkgUnit})</div>
                                </div>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-center min-w-[110px]">
                              <div className="flex items-center gap-1.5 justify-center">
                                <div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      row.percent === 100
                                        ? "bg-emerald-500"
                                        : row.percent > 0
                                        ? "bg-blue-600"
                                        : "bg-slate-200"
                                    }`}
                                    style={{ width: `${row.percent}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] font-bold text-slate-700">
                                  {row.percent}%
                                </span>
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <Badge color={itemStatusBadge.color}>
                                {itemStatusBadge.label}
                              </Badge>
                            </td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <Link
                                href={`/purchasing/purchase-orders/${row.poId}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              >
                                Buka PO <ArrowRight className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Detailed View Footer */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Menampilkan <strong className="text-slate-800">{allFlatItems.length}</strong> baris item dari{" "}
              <strong className="text-slate-800">{sortedPOs.length}</strong> Purchase Order di halaman ini
            </span>
            <button
              type="button"
              onClick={() => setMainView("summary")}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Kembali ke Ringkasan PO →
            </button>
          </div>
        </div>
      )}

      {/* SERVER-SIDE PAGINATION CONTROLS */}
      {renderPaginationControls()}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Purchase Order?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Anda akan menghapus PO <strong className="text-slate-900">{deleteTarget.poNumber}</strong> untuk supplier{" "}
                  <strong className="text-slate-900">{deleteTarget.supplier.name}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200/80 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-800">
                <span>
                  {deleteTarget?.status === "CANCELLED" ? "Informasi PO Dibatalkan" : "Informasi Status Draft"}
                </span>
              </p>
              {deleteTarget?.status === "CANCELLED"
                ? "PO ini berstatus Dibatalkan (Cancelled). Tindakan ini akan menghapus data PO dan seluruh item rinciannya secara permanen dari sistem."
                : "PO ini belum dikirim ke supplier (status Draft). Tindakan ini akan menghapus data PO dan seluruh item rinciannya secara permanen."}
            </div>

            {deleteError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </Button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? "Menghapus..." : "Ya, Hapus PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FLOATING ACTION DOCK: PERSETUJUAN MASSAL (MANAGER L1 & PRESDIR L2) ─── */}
      {isApprover && selectedPoIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="pointer-events-auto bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/80 px-5 py-3.5 flex flex-wrap items-center gap-4 max-w-2xl w-full justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isL2
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span>
                    {isEnglish
                      ? `${selectedPoIds.size} ${selectedPoIds.size === 1 ? "PO" : "POs"} Selected`
                      : `${selectedPoIds.size} PO Terpilih`}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isL2
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-amber-500 text-slate-950"
                    }`}
                  >
                    {isL2 ? "President Director (L2)" : isEnglish ? "Purchasing Manager (L1)" : "Manager L1"}
                  </span>
                </p>
                <p className="text-[11px] text-slate-300">
                  {isL2
                    ? "Ready for batch digital signature authorization"
                    : isEnglish
                    ? "Ready for batch manager digital approval"
                    : "Siap disetujui (TTD digital) secara bersamaan"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPoIds(new Set())}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {isEnglish ? "Cancel" : "Batal"}
              </button>
              <button
                type="button"
                onClick={() => setBatchApproveModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer ${
                  isL2
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/40"
                    : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-950/40"
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {isEnglish
                    ? `Approve Selected (${selectedPoIds.size})`
                    : `Approve Terpilih (${selectedPoIds.size})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL KONFIRMASI BATCH APPROVAL L1 & L2 ─── */}
      {batchApproveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isL2
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                }`}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isL2
                    ? "Batch Authorization — President Director (L2)"
                    : isEnglish
                    ? "Batch Approval — Purchasing Manager (L1)"
                    : "Persetujuan Massal (Batch Approval)"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isL2
                    ? "Digital Signature & SHA-256 Cryptographic Verification"
                    : isEnglish
                    ? "Digital Signature & Manager Authorization"
                    : "Verifikasi tanda tangan digital Manager Purchasing (L1)"}
                </p>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl text-xs space-y-1 border ${
                isL2
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                  : "bg-amber-50/70 border-amber-200 text-amber-900"
              }`}
            >
              <p className="font-semibold">
                {isEnglish
                  ? `You are about to sign and approve ${selectedPoIds.size} Purchase Order${selectedPoIds.size === 1 ? "" : "s"}:`
                  : `Anda akan menyetujui ${selectedPoIds.size} Purchase Order berikut:`}
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] pt-1">
                {sortedPOs
                  .filter((p) => selectedPoIds.has(p.id))
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between py-1 border-b ${
                        isL2 ? "border-emerald-200/60" : "border-amber-200/50"
                      }`}
                    >
                      <span className="font-bold">{p.poNumber}</span>
                      <span className="text-slate-600 font-sans truncate max-w-[220px]">
                        {p.supplier.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isL2
                ? "Upon confirmation, a cryptographic SHA-256 verification hash will be sealed for each Purchase Order, marking them fully authorized and ready for delivery/processing. This approval action will be permanently recorded in the system audit trail."
                : isEnglish
                ? "Upon confirmation, your digital signature and approval timestamp will be recorded for each Purchase Order, advancing them to the President Director for final authorization. This approval action will be permanently recorded in the system audit trail."
                : "Setelah disetujui, Purchase Order akan diteruskan ke tahap persetujuan Presdir (L2) atau siap dikirimkan ke supplier. Seluruh tindakan persetujuan akan dicatat secara otomatis ke dalam audit log sistem."}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isBatchApproving}
                onClick={() => setBatchApproveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {isEnglish ? "Cancel" : "Batal"}
              </button>
              <button
                type="button"
                disabled={isBatchApproving}
                onClick={handleBatchApprove}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isBatchApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isEnglish ? "Processing..." : "Memproses..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {isEnglish
                        ? `Yes, Approve All (${selectedPoIds.size} ${selectedPoIds.size === 1 ? "PO" : "POs"})`
                        : `Ya, Setujui Semua (${selectedPoIds.size} PO)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFIKASI SUKSES ─── */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="ml-2 text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
