"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Package,
  Layers,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Link2,
  Unlink,
  Check,
  Info,
  ListFilter,
  Eye,
  Save,
  ArrowRight,
  Truck,
} from "lucide-react";
import { Card, PageTitle, Badge } from "@/components/ui";

type ReconcileItem = {
  id: string; // purchaseOrderDetailId
  itemId: string;
  code?: string;
  description: string;
  unitPrice?: number;
  orderedQty: number;
  orderedUnit: string;
  packageQty: number | null;
  packageUnit: string | null;
  packageSize: number | null;
  receivedQty: number;
  receivedPackageQty: number | null;
  completionPct: number;
  status: "COMPLETE" | "PARTIAL" | "PENDING";
  suratJalans: string[];
  matchType?: "EXACT" | "FUZZY" | "ALIAS" | "NONE";
  matchScore?: number;
  incomingDescription?: string | null;
  incomingCode?: string | null;
};

type UnmatchedIncomingItem = {
  code?: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  suratJalans: string[];
  suggestedMatch?: {
    poItemDescription: string;
    poItemCode: string;
    orderedQty: number;
    orderedUnit: string;
    rank: number;
    reason: string;
  } | null;
};

type IncomingPhysicalItem = {
  code: string;
  description: string;
  receivedQty: number;
  unit: string;
  suratJalans: string[];
  isMatched: boolean;
};

type RawShipment = {
  suratJalan: string;
  receiveDate: string;
  code: string;
  partName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  alreadyInDB?: boolean;
};

type ReconciledPO = {
  poNumber: string;
  poId: string;
  supplierId: string;
  supplierName: string;
  warehouseId?: string | null;
  warehouseName: string;
  inIncoming: boolean;
  reconcileStatus: "CLOSED" | "PARTIAL" | "PENDING" | "NO_INCOMING";
  dbStatus?: string;
  isAlreadyInputted?: boolean;
  alreadyInputtedReason?: string | null;
  existingDeliveryCount?: number;
  dbReceivedQtyTotal?: number;
  items: ReconcileItem[];
  unmatchedIncomingItems?: UnmatchedIncomingItem[];
  allIncomingItems?: IncomingPhysicalItem[];
  rawShipments?: RawShipment[];
  discrepancyCount?: number;
  totalOrderedItems: number;
  completedItems: number;
  overallPct: number;
};

type Summary = {
  totalInDB: number;
  totalInIncoming: number;
  matchedInDB: number;
  notInDB: number;
  dbPOsWithoutIncoming: number;
  closedPOs: number;
  partialPOs: number;
  pendingPOs: number;
  discrepancyPOs: number;
  fuzzyMatchedCount?: number;
  unmatchedIncomingCount?: number;
  pendingInputPOs?: number;
  alreadyInputtedPOs?: number;
  discrepancyPendingCount?: number;
};

type ReconcileResult = {
  summary: Summary;
  reconciled: ReconciledPO[];
  notInDB: string[];
};

const STATUS_CONFIG = {
  CLOSED: { label: "Selesai (CLOSED)", color: "green" as const, icon: CheckCircle2 },
  PARTIAL: { label: "Sebagian (ON PROGRESS)", color: "amber" as const, icon: Clock },
  PENDING: { label: "Belum Terkirim", color: "blue" as const, icon: Clock },
  NO_INCOMING: { label: "Tidak Ada Incoming", color: "slate" as const, icon: XCircle },
};

const ITEM_STATUS_CONFIG = {
  COMPLETE: { label: "Selesai", color: "green" as const },
  PARTIAL: { label: "Sebagian", color: "amber" as const },
  PENDING: { label: "Belum", color: "slate" as const },
};

export default function ReconcilePOPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});
  const [mainTab, setMainTab] = useState<"PENDING" | "ALREADY_INPUTTED" | "ALL">("PENDING");
  const [filter, setFilter] = useState<"ALL" | "DISCREPANCY" | "CLOSED" | "PARTIAL" | "PENDING">("ALL");
  const [poSubTabs, setPoSubTabs] = useState<Record<string, "COMPARISON" | "INCOMING_LIST">>({});
  const [aliasSavedNotice, setAliasSavedNotice] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committedPoMap, setCommittedPoMap] = useState<Record<string, boolean>>({});
  const [commitSuccessModal, setCommitSuccessModal] = useState<{
    updatedPOs: number;
    createdDeliveries: number;
    createdReceivings: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function togglePO(poNum: string) {
    setExpandedPOs((prev) => ({ ...prev, [poNum]: !prev[poNum] }));
  }

  function setPoTab(poNum: string, tab: "COMPARISON" | "INCOMING_LIST") {
    setPoSubTabs((prev) => ({ ...prev, [poNum]: tab }));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCommittedPoMap({});

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/import/reconcile-po", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Gagal memproses rekonsiliasi");
        return;
      }

      setResult(data);
      setFilter("ALL");

      const pendingList = (data.reconciled || []).filter((r: ReconciledPO) => !r.isAlreadyInputted);
      const expanded: Record<string, boolean> = {};

      if (pendingList.length > 0) {
        setMainTab("PENDING");
        pendingList.forEach((r: ReconciledPO) => {
          if ((r.unmatchedIncomingItems && r.unmatchedIncomingItems.length > 0) || r.reconcileStatus === "PARTIAL") {
            expanded[r.poNumber] = true;
          }
        });
        if (Object.keys(expanded).length === 0) {
          pendingList.slice(0, 5).forEach((r: ReconciledPO) => {
            expanded[r.poNumber] = true;
          });
        }
      } else {
        // Jika seluruh incoming dalam file sudah pernah diinput sebelumnya, tampilkan tab arsip
        setMainTab("ALREADY_INPUTTED");
        (data.reconciled || []).slice(0, 3).forEach((r: ReconciledPO) => {
          expanded[r.poNumber] = true;
        });
      }

      setExpandedPOs(expanded);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function recalculatePO(po: ReconciledPO): ReconciledPO {
    const completedItems = po.items.filter((i) => i.status === "COMPLETE").length;
    const totalItems = po.items.length;
    const overallPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const reconcileStatus =
      completedItems === totalItems ? "CLOSED"
      : completedItems > 0 ? "PARTIAL"
      : "PENDING";

    const discrepancyCount = (po.unmatchedIncomingItems?.length || 0) +
      po.items.filter((i) => i.matchType === "FUZZY" || (i.status === "PENDING" && (po.unmatchedIncomingItems?.length || 0) > 0)).length;

    return {
      ...po,
      completedItems,
      overallPct,
      reconcileStatus,
      discrepancyCount,
    };
  }

  async function handleManualMapItem(
    poNumber: string,
    unmatchedItem: UnmatchedIncomingItem,
    targetItemDescription: string,
    saveAlias = true
  ) {
    if (!result || !targetItemDescription) return;

    const incomingKeyDesc = (unmatchedItem.description || "").trim().toUpperCase();
    const incomingKeyCode = unmatchedItem.code ? unmatchedItem.code.trim().toUpperCase() : null;

    if (saveAlias) {
      const keysToSave = [incomingKeyDesc];
      if (incomingKeyCode) keysToSave.push(incomingKeyCode);

      for (const k of keysToSave) {
        fetch("/api/import/reconcile-po/alias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incomingKey: k,
            targetItemDescription,
          }),
        }).catch((e) => console.warn("Could not save alias:", e));
      }
    }

    let affectedOtherPOs = 0;
    let autoResolvedCount = 0;

    setResult((prev) => {
      if (!prev) return prev;

      const updatedReconciled = prev.reconciled.map((po) => {
        // Cek apakah PO ini adalah target PO atau PO lain yang punya item incoming sejenis
        const matchingUnmatchedInThisPO = (po.unmatchedIncomingItems ?? []).filter((u) => {
          if (incomingKeyCode && u.code && u.code.trim().toUpperCase() === incomingKeyCode) return true;
          if (u.description && u.description.trim().toUpperCase() === incomingKeyDesc) return true;
          return false;
        });

        // Jika bukan PO yang diklik dan tidak memiliki item incoming sejenis, biarkan tetap
        if (po.poNumber !== poNumber && matchingUnmatchedInThisPO.length === 0) {
          return po;
        }

        // Cek apakah PO ini memiliki item PO tujuan (targetItemDescription)
        const hasTargetPOItem = po.items.some((i) => i.description === targetItemDescription);
        if (!hasTargetPOItem) {
          return po;
        }

        let poModified = false;
        const claimedUnmatchedDescSet = new Set<string>();

        const updatedItems = po.items.map((i) => {
          if (i.description !== targetItemDescription) return i;

          // Ambil item incoming yang akan dipasangkan ke item PO ini
          const itemsToApply = po.poNumber === poNumber
            ? [unmatchedItem]
            : matchingUnmatchedInThisPO;

          if (itemsToApply.length === 0) return i;

          let addedQty = 0;
          const combinedSJs = [...i.suratJalans];
          const matchedIncomingDesc = i.incomingDescription || unmatchedItem.description;
          const matchedIncomingCode = i.incomingCode || unmatchedItem.code || null;

          for (const itemToApply of itemsToApply) {
            addedQty += itemToApply.receivedQty;
            claimedUnmatchedDescSet.add(itemToApply.description);
            for (const sj of itemToApply.suratJalans) {
              if (sj && !combinedSJs.includes(sj)) combinedSJs.push(sj);
            }
          }

          if (addedQty > 0) {
            poModified = true;
            if (po.poNumber !== poNumber) {
              autoResolvedCount += itemsToApply.length;
            }
          }

          const receivedQty = (i.receivedQty || 0) + addedQty;
          const masterPkgSize = i.packageSize;
          const receivedPackageQty = masterPkgSize && masterPkgSize > 0
            ? Math.round((receivedQty / masterPkgSize) * 100) / 100
            : null;
          const completionPct = i.orderedQty > 0
            ? (receivedQty >= i.orderedQty ? 100 : Math.min(99, Math.floor((receivedQty / i.orderedQty) * 100)))
            : 0;
          const status = completionPct >= 100 ? ("COMPLETE" as const) : completionPct > 0 ? ("PARTIAL" as const) : ("PENDING" as const);

          return {
            ...i,
            receivedQty,
            receivedPackageQty,
            completionPct,
            status,
            matchType: "ALIAS" as const,
            matchScore: 100,
            incomingDescription: matchedIncomingDesc,
            incomingCode: matchedIncomingCode,
            suratJalans: combinedSJs,
          };
        });

        if (poModified && po.poNumber !== poNumber) {
          affectedOtherPOs++;
        }

        // Hapus item yang sudah berhasil dipasangkan dari daftar unmatchedIncomingItems di PO ini
        const remainingUnmatched = (po.unmatchedIncomingItems ?? []).filter((u) => {
          if (po.poNumber === poNumber) {
            return u.description !== unmatchedItem.description || u.code !== unmatchedItem.code;
          }
          return !claimedUnmatchedDescSet.has(u.description);
        });

        // Update allIncomingItems jika ada
        const updatedAllIncoming = (po.allIncomingItems ?? []).map((ai) => {
          if (
            claimedUnmatchedDescSet.has(ai.description) ||
            (po.poNumber === poNumber && ai.description === unmatchedItem.description)
          ) {
            return { ...ai, isMatched: true };
          }
          return ai;
        });

        return recalculatePO({
          ...po,
          items: updatedItems,
          unmatchedIncomingItems: remainingUnmatched,
          allIncomingItems: updatedAllIncoming,
        });
      });

      // Hitung ulang ringkasan
      const closedPOs = updatedReconciled.filter((r) => r.reconcileStatus === "CLOSED").length;
      const partialPOs = updatedReconciled.filter((r) => r.reconcileStatus === "PARTIAL").length;
      const pendingPOs = updatedReconciled.filter((r) => r.reconcileStatus === "PENDING").length;
      const discrepancyPOs = updatedReconciled.filter((r) => (r.discrepancyCount || 0) > 0).length;
      const fuzzyMatchedCount = updatedReconciled.reduce(
        (acc, po) => acc + po.items.filter((i) => i.matchType === "FUZZY").length, 0
      );
      const unmatchedIncomingCount = updatedReconciled.reduce(
        (acc, po) => acc + (po.unmatchedIncomingItems?.length || 0), 0
      );

      return {
        ...prev,
        reconciled: updatedReconciled,
        summary: {
          ...prev.summary,
          closedPOs,
          partialPOs,
          pendingPOs,
          discrepancyPOs,
          fuzzyMatchedCount,
          unmatchedIncomingCount,
        },
      };
    });

    if (autoResolvedCount > 0) {
      setAliasSavedNotice(
        `⚡ Alias "${unmatchedItem.description}" berhasil disimpan! Otomatis menghubungkan ${autoResolvedCount} item sejenis di ${affectedOtherPOs} PO lainnya.`
      );
    } else {
      setAliasSavedNotice(`⚡ Alias "${unmatchedItem.description}" berhasil disimpan dan akan otomatis terdeteksi untuk file selanjutnya.`);
    }
    setTimeout(() => setAliasSavedNotice(null), 5000);
  }

  function handleUnmatchItem(poNumber: string, itemDescription: string) {
    if (!result) return;
    setResult((prev) => {
      if (!prev) return prev;
      const updatedReconciled = prev.reconciled.map((po) => {
        if (po.poNumber !== poNumber) return po;

        const targetItem = po.items.find((i) => i.description === itemDescription);
        if (!targetItem || !targetItem.incomingDescription) return po;

        const newUnmatched: UnmatchedIncomingItem = {
          code: targetItem.incomingCode || undefined,
          description: targetItem.incomingDescription,
          orderedQty: 0,
          receivedQty: targetItem.receivedQty,
          unit: targetItem.orderedUnit,
          suratJalans: targetItem.suratJalans,
        };

        const updatedItems = po.items.map((i) => {
          if (i.description !== itemDescription) return i;
          return {
            ...i,
            receivedQty: 0,
            receivedPackageQty: 0,
            completionPct: 0,
            status: "PENDING" as const,
            matchType: "NONE" as const,
            matchScore: 0,
            incomingDescription: null,
            incomingCode: null,
            suratJalans: [],
          };
        });

        const existingUnmatched = po.unmatchedIncomingItems ?? [];
        return recalculatePO({
          ...po,
          items: updatedItems,
          unmatchedIncomingItems: [...existingUnmatched, newUnmatched],
        });
      });

      const closedPOs = updatedReconciled.filter((r) => r.reconcileStatus === "CLOSED").length;
      const partialPOs = updatedReconciled.filter((r) => r.reconcileStatus === "PARTIAL").length;
      const pendingPOs = updatedReconciled.filter((r) => r.reconcileStatus === "PENDING").length;
      const discrepancyPOs = updatedReconciled.filter((r) => (r.discrepancyCount || 0) > 0).length;

      return {
        ...prev,
        reconciled: updatedReconciled,
        summary: {
          ...prev.summary,
          closedPOs,
          partialPOs,
          pendingPOs,
          discrepancyPOs,
        },
      };
    });
  }

  async function handleCommitIncoming(targetPoNumbers?: string[]) {
    if (!result) return;

    let posToCommit: ReconciledPO[] = [];
    if (targetPoNumbers && targetPoNumbers.length > 0) {
      posToCommit = result.reconciled.filter((p) => targetPoNumbers.includes(p.poNumber));
    } else if (mainTab === "PENDING") {
      // Fokus HANYA commit PO yang belum terinput ke database dan belum dicommit di sesi ini
      posToCommit = result.reconciled.filter(
        (p) => !p.isAlreadyInputted && !committedPoMap[p.poNumber]
      );
    } else {
      posToCommit = result.reconciled.filter((p) => !committedPoMap[p.poNumber]);
    }

    if (posToCommit.length === 0) {
      alert("Tidak ada incoming baru yang perlu diinput ke database.");
      return;
    }

    const hasDiscrepancies = posToCommit.some(
      (p) => (p.unmatchedIncomingItems?.length ?? 0) > 0
    );

    if (hasDiscrepancies) {
      const confirmCommit = window.confirm(
        "Perhatian: Masih ada beberapa item yang belum cocok / beda nama.\nItem yang belum cocok tidak akan diinput ke penerimaan PO hingga Anda memasangkannya.\n\nApakah Anda tetap ingin melanjutkan simpan ke database?"
      );
      if (!confirmCommit) return;
    }

    setCommitting(true);
    setError(null);

    try {
      const res = await fetch("/api/import/reconcile-po/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pos: posToCommit }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Gagal menyimpan data incoming");
        return;
      }

      const updatedMap = { ...committedPoMap };
      if (Array.isArray(data.successfulPONumbers)) {
        data.successfulPONumbers.forEach((poNo: string) => {
          updatedMap[poNo] = true;
        });
      } else {
        posToCommit.forEach((p) => {
          updatedMap[p.poNumber] = true;
        });
      }
      setCommittedPoMap(updatedMap);

      if (data.errorCount > 0 && data.errors?.length > 0) {
        setError(`Sebagian PO gagal disimpan (${data.errorCount} kendala):\n${data.errors.slice(0, 5).join("\n")}`);
      }

      setCommitSuccessModal({
        updatedPOs: data.updatedPOs,
        createdDeliveries: data.createdDeliveries,
        createdReceivings: data.createdReceivings,
      });
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyimpan data");
    } finally {
      setCommitting(false);
    }
  }

  // 1. Kategorisasi PO: Belum Terinput vs Sudah Selesai/Pernah Diinput
  const pendingInputList = (result?.reconciled ?? []).filter(
    (p) => !p.isAlreadyInputted && !committedPoMap[p.poNumber]
  );
  const alreadyInputtedList = (result?.reconciled ?? []).filter(
    (p) => p.isAlreadyInputted || committedPoMap[p.poNumber]
  );

  const pendingInputCount = pendingInputList.length;
  const alreadyInputtedCount = alreadyInputtedList.length;

  // 2. Daftar PO berdasarkan Sub Menu / Tab Utama yang aktif
  const tabScopedPOs =
    mainTab === "PENDING"
      ? pendingInputList
      : mainTab === "ALREADY_INPUTTED"
      ? alreadyInputtedList
      : (result?.reconciled ?? []);

  // 3. Filter sekunder di dalam tab aktif
  const filteredPOs = tabScopedPOs.filter((po) => {
    if (filter === "ALL") return true;
    if (filter === "DISCREPANCY") return (po.unmatchedIncomingItems && po.unmatchedIncomingItems.length > 0) || (po.discrepancyCount || 0) > 0;
    if (filter === "CLOSED") return po.reconcileStatus === "CLOSED";
    if (filter === "PARTIAL") return po.reconcileStatus === "PARTIAL";
    if (filter === "PENDING") return po.reconcileStatus === "PENDING";
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Rekonsiliasi & Input Incoming PO"
        subtitle="Cocokkan data pengiriman di Excel dengan PO di database, lalu simpan penerimaan ke sistem"
        breadcrumb={["Purchase Orders", "Rekonsiliasi"]}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/purchasing/purchase-orders")}
              className="btn btn-light text-xs gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke PO
            </button>
            {result && (
              <button
                type="button"
                disabled={committing || (mainTab === "PENDING" && pendingInputCount === 0)}
                onClick={() => handleCommitIncoming()}
                className={`text-xs gap-1.5 shadow-sm font-semibold py-2 px-3.5 rounded-lg flex items-center transition-all cursor-pointer ${
                  pendingInputCount === 0 && mainTab === "PENDING"
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                <Save className="w-4 h-4" />
                {committing
                  ? "Menyimpan..."
                  : mainTab === "PENDING"
                  ? pendingInputCount > 0
                    ? `Input Incoming Belum Terinput (${pendingInputCount} PO) ke Database`
                    : "Semua Incoming Sudah Diinput"
                  : mainTab === "ALREADY_INPUTTED"
                  ? `Input Terpilih ke Database`
                  : `Input Semua Incoming (${result.reconciled.length} PO) ke Database`}
              </button>
            )}
          </div>
        }
      />

      {/* Upload card */}
      <Card className="!p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 text-sm">Upload File Incoming (Penerimaan Barang)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Format: <code className="bg-slate-100 px-1 rounded text-[11px]">incoming new purchasing.xlsx</code>
              — Sistem mencocokkan otomatis berdasarkan KODE item, nama part, dan riwayat alias.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="reconcile-upload"
            />
            <label
              htmlFor="reconcile-upload"
              className={`btn btn-primary text-sm px-5 py-2 gap-2 cursor-pointer ${loading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Upload className="w-4 h-4" />
              {loading ? "Menganalisis..." : result ? "Upload Ulang File" : "Pilih File Incoming"}
            </label>
          </div>
        </div>
        {error && (
          <div className="mt-4 alert alert-danger flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {aliasSavedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{aliasSavedNotice}</span>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Incoming Focus & DB Note Banner */}
          <div className="p-4 rounded-xl border bg-gradient-to-r from-indigo-50/70 via-slate-50 to-emerald-50/40 border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-700">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900">
                  {pendingInputCount > 0 ? (
                    <span>
                      Fokus: Menampilkan <strong className="text-indigo-600">{pendingInputCount} PO</strong> dengan incoming yang <span className="underline decoration-indigo-400 font-bold">belum terinput</span> ke database.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Semua incoming dari file ini sudah selesai / pernah diinput sebelumnya ke database.
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {alreadyInputtedCount > 0 && (
                    <span>
                      Sebanyak <strong>{alreadyInputtedCount} PO</strong> yang sebelumnya sudah selesai / sudah pernah diinput dipisahkan ke sub-menu terpisah agar Anda dapat fokus.
                    </span>
                  )}
                  {result.summary.dbPOsWithoutIncoming > 0 && (
                    <span className="ml-1">
                      ({result.summary.dbPOsWithoutIncoming} PO lain di DB tanpa incoming disembunyikan).
                    </span>
                  )}
                </div>
              </div>
            </div>

            {pendingInputCount > 0 && (
              <button
                type="button"
                disabled={committing}
                onClick={() => handleCommitIncoming()}
                className="py-2 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                {committing ? "Menyimpan..." : `Input ${pendingInputCount} PO Belum Terinput`}
              </button>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Fokus Belum Terinput */}
            <div
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                mainTab === "PENDING"
                  ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-200"
                  : "bg-white border-slate-200 hover:border-indigo-300"
              }`}
              onClick={() => {
                setMainTab("PENDING");
                setFilter("ALL");
              }}
            >
              <div className="flex items-center justify-between text-indigo-700 text-xs font-semibold mb-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" /> Belum Terinput (Fokus)
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  Prioritas
                </span>
              </div>
              <p className="text-2xl font-bold text-indigo-950">{pendingInputCount}</p>
              <p className="text-[11px] text-indigo-600 mt-1 font-medium">
                {pendingInputCount > 0 ? "Perlu diinput ke sistem" : "Semua sudah terinput"}
              </p>
            </div>

            {/* Card 2: Perlu Koreksi Nama */}
            <div
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                filter === "DISCREPANCY" && mainTab === "PENDING"
                  ? "bg-rose-100/90 border-rose-300 ring-2 ring-rose-200"
                  : (result.summary.discrepancyPendingCount ?? 0) > 0 || (result.summary.discrepancyPOs ?? 0) > 0
                  ? "bg-rose-50 border-rose-200 hover:bg-rose-100/70"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => {
                setMainTab("PENDING");
                setFilter("DISCREPANCY");
              }}
            >
              <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Perlu Koreksi Nama
              </div>
              <p className="text-2xl font-bold text-rose-800">
                {pendingInputList.filter((p) => (p.unmatchedIncomingItems?.length || 0) > 0 || (p.discrepancyCount || 0) > 0).length}
              </p>
              <p className="text-[11px] text-rose-600 mt-1">Item incoming tak cocok</p>
            </div>

            {/* Card 3: Siap Input Lengkap */}
            <div
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                filter === "CLOSED" && mainTab === "PENDING"
                  ? "bg-emerald-100 border-emerald-300 ring-2 ring-emerald-200"
                  : "bg-white border-slate-200 hover:border-emerald-300"
              }`}
              onClick={() => {
                setMainTab("PENDING");
                setFilter("CLOSED");
              }}
            >
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Siap Input Lengkap
              </div>
              <p className="text-2xl font-bold text-emerald-800">
                {pendingInputList.filter((p) => p.reconcileStatus === "CLOSED").length}
              </p>
              <p className="text-[11px] text-emerald-600 mt-1">100% item terpenuhi</p>
            </div>

            {/* Card 4: Sudah Selesai / Terinput Sebelumnya */}
            <div
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                mainTab === "ALREADY_INPUTTED"
                  ? "bg-slate-100 border-slate-400 ring-2 ring-slate-300"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => {
                setMainTab("ALREADY_INPUTTED");
                setFilter("ALL");
              }}
            >
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-500" /> Sudah Selesai / Terinput
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                  Sub Menu
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{alreadyInputtedCount}</p>
              <p className="text-[11px] text-slate-500 mt-1">Tersimpan di sub menu terpisah</p>
            </div>
          </div>

          {/* Sub Menu Navigasi Utama */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setMainTab("PENDING");
                  setFilter("ALL");
                }}
                className={`text-xs px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  mainTab === "PENDING"
                    ? "bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Incoming Belum Terinput</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  mainTab === "PENDING"
                    ? "bg-indigo-100 text-indigo-800"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {pendingInputCount} PO
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainTab("ALREADY_INPUTTED");
                  setFilter("ALL");
                }}
                className={`text-xs px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  mainTab === "ALREADY_INPUTTED"
                    ? "bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sudah Pernah Diinput / Selesai</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  mainTab === "ALREADY_INPUTTED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {alreadyInputtedCount} PO
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainTab("ALL");
                  setFilter("ALL");
                }}
                className={`text-xs px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  mainTab === "ALL"
                    ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>Semua ({result.reconciled.length})</span>
              </button>
            </div>

            {/* Filter Sekunder (Status PO di Tab Aktif) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium">Filter:</span>
              {[
                { id: "ALL", label: `Semua (${tabScopedPOs.length})` },
                {
                  id: "DISCREPANCY",
                  label: `Beda Nama (${tabScopedPOs.filter((p) => (p.unmatchedIncomingItems?.length || 0) > 0 || (p.discrepancyCount || 0) > 0).length})`,
                  alert: tabScopedPOs.some((p) => (p.unmatchedIncomingItems?.length || 0) > 0 || (p.discrepancyCount || 0) > 0),
                },
                { id: "CLOSED", label: `Lengkap (${tabScopedPOs.filter((p) => p.reconcileStatus === "CLOSED").length})` },
                { id: "PARTIAL", label: `Sebagian (${tabScopedPOs.filter((p) => p.reconcileStatus === "PARTIAL").length})` },
                { id: "PENDING", label: `Belum Ada (${tabScopedPOs.filter((p) => p.reconcileStatus === "PENDING").length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    filter === tab.id
                      ? tab.alert
                        ? "bg-rose-600 text-white font-semibold"
                        : "bg-slate-800 text-white font-semibold"
                      : tab.alert
                      ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.alert && <AlertTriangle className="w-3 h-3 shrink-0" />}
                  {tab.label}
                </button>
              ))}
              {filter !== "ALL" && (
                <button
                  onClick={() => setFilter("ALL")}
                  className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 ml-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* PO List */}
          <div className="space-y-3">
            {filteredPOs.length === 0 && (
              mainTab === "PENDING" && pendingInputCount === 0 ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-8 text-center space-y-3 animate-in fade-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-sm">Semua Incoming Sudah Selesai / Terinput!</h4>
                    <p className="text-xs text-emerald-700 max-w-md mx-auto mt-1">
                      Seluruh pengiriman barang pada file ini sebelumnya sudah tercatat atau sudah berstatus selesai di database.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMainTab("ALREADY_INPUTTED");
                      setFilter("ALL");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Buka Sub Menu: Sudah Pernah Diinput ({alreadyInputtedCount} PO)
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
                  Tidak ada PO dengan filter ini.
                </div>
              )
            )}
            {filteredPOs.map((po) => {
              const cfg = STATUS_CONFIG[po.reconcileStatus];
              const Icon = cfg.icon;
              const isExpanded = expandedPOs[po.poNumber];
              const activeSubTab = poSubTabs[po.poNumber] || "COMPARISON";
              const unmatchedCount = po.unmatchedIncomingItems?.length ?? 0;
              const fuzzyCount = po.items.filter((i) => i.matchType === "FUZZY").length;
              const aliasCount = po.items.filter((i) => i.matchType === "ALIAS").length;
              const isCommitted = committedPoMap[po.poNumber];

              return (
                <div
                  key={po.poNumber}
                  className={`bg-white rounded-xl border shadow-xs transition-all overflow-hidden ${
                    isCommitted
                      ? "border-emerald-400 ring-1 ring-emerald-200 bg-emerald-50/10"
                      : po.isAlreadyInputted
                      ? "border-slate-200 bg-slate-50/30"
                      : unmatchedCount > 0
                      ? "border-rose-300 ring-1 ring-rose-100"
                      : "border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {/* PO Header */}
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50"
                    onClick={() => togglePO(po.poNumber)}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className={`w-4 h-4 ${
                          po.reconcileStatus === "CLOSED" ? "text-emerald-500" :
                          po.reconcileStatus === "PARTIAL" ? "text-amber-500" :
                          "text-slate-400"
                        }`} />
                        <span className="font-bold text-slate-900 text-sm font-mono">{po.poNumber}</span>
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                        <Badge color="slate">{po.supplierName}</Badge>
                        <span className="text-xs text-slate-400">{po.warehouseName}</span>

                        {isCommitted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Baru Saja Diinput ke Database
                          </span>
                        ) : po.isAlreadyInputted ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300"
                            title={po.alreadyInputtedReason || "Sudah pernah diinput sebelumnya"}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {po.alreadyInputtedReason || "Sudah Pernah Diinput"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            Belum Terinput ke DB
                          </span>
                        )}

                        {unmatchedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            {unmatchedCount} Beda Nama / Tak Cocok
                          </span>
                        )}

                        {aliasCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            {aliasCount} Alias Terdaftar
                          </span>
                        )}

                        {fuzzyCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                            {fuzzyCount} Fuzzy
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="flex items-center gap-3">
                        <div className="w-40 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              po.overallPct >= 100 ? "bg-emerald-500" :
                              po.overallPct > 0 ? "bg-amber-400" :
                              "bg-slate-200"
                            }`}
                            style={{ width: `${po.overallPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {po.completedItems}/{po.totalOrderedItems} item terpenuhi ({po.overallPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={committing || isCommitted}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCommitIncoming([po.poNumber]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                          isCommitted
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : po.isAlreadyInputted
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                        title={
                          po.isAlreadyInputted
                            ? `PO ini sebelumnya sudah selesai/tercatat di database. Klik jika ingin sinkronisasi / input ulang.`
                            : `Input penerimaan PO ${po.poNumber} ke database`
                        }
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isCommitted ? "Tersimpan" : po.isAlreadyInputted ? "Input Ulang" : "Input PO Ini"}
                      </button>
                      <div className="text-slate-400 pl-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/40">
                      {/* Sub-tab selection */}
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-100/70 border-b border-slate-200 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPoTab(po.poNumber, "COMPARISON"); }}
                            className={`px-3 py-1 rounded-md font-medium transition-colors ${
                              activeSubTab === "COMPARISON"
                                ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Komparasi PO & Koreksi Nama
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPoTab(po.poNumber, "INCOMING_LIST"); }}
                            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                              activeSubTab === "INCOMING_LIST"
                                ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Data Fisik di File Incoming ({po.allIncomingItems?.length || 0})
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-400">PO ID: {po.poId}</span>
                      </div>

                      {/* Discrepancy Inspector Card (Penyorot Kesalahan Nama) */}
                      {po.unmatchedIncomingItems && po.unmatchedIncomingItems.length > 0 && activeSubTab === "COMPARISON" && (
                        <div className="p-4 bg-rose-50/90 border-b border-rose-200 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Deteksi Kesalahan Nama / Belum Cocok ({po.unmatchedIncomingItems.length} item)</span>
                              </div>
                              <p className="text-[11px] text-rose-600 mt-0.5">
                                Barang berikut tercatat di file incoming, namun nama produk tidak cocok dengan PO.
                                Pasangkan nama sebelum menginput ke database:
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {po.unmatchedIncomingItems.map((u, ui) => (
                              <div
                                key={ui}
                                className="p-3 bg-white rounded-lg border border-rose-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                              >
                                {/* Sisi Kiri: Data di Excel Incoming */}
                                <div className="space-y-1 md:w-5/12">
                                  <div className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
                                    Tercatat di File Incoming (Excel):
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {u.code && (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                                        {u.code}
                                      </span>
                                    )}
                                    <span className="font-bold text-slate-900">{u.description}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                                      Diterima: {u.receivedQty} {u.unit}
                                    </span>
                                  </div>
                                  {u.suratJalans.length > 0 && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      SJ: {u.suratJalans.join(", ")}
                                    </div>
                                  )}
                                </div>

                                {/* Sisi Kanan: Rekomendasi & Pasangkan */}
                                <div className="md:w-7/12 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                                  {u.suggestedMatch ? (
                                    <div className="flex-1 p-2 rounded-md bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between gap-1">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[10px] font-bold text-emerald-700 uppercase">
                                          Rekomendasi di PO:
                                        </span>
                                        <span className="text-[10px] text-emerald-800 font-medium">
                                          {u.suggestedMatch.reason}
                                        </span>
                                      </div>
                                      <div className="font-semibold text-slate-900 truncate" title={u.suggestedMatch.poItemDescription}>
                                        [{u.suggestedMatch.poItemCode}] {u.suggestedMatch.poItemDescription}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleManualMapItem(po.poNumber, u, u.suggestedMatch!.poItemDescription, true)}
                                        className="mt-1 w-full py-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        Pasangkan & Simpan Alias
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex-1 text-[11px] text-slate-400 italic">
                                      Pilih pasangan item di PO secara manual:
                                    </div>
                                  )}

                                  {/* Manual dropdown fallback */}
                                  <div className="sm:w-48 flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-400">Pilih item PO lain:</span>
                                    <select
                                      className="text-[11px] py-1 px-2 border rounded-md bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleManualMapItem(po.poNumber, u, e.target.value, true);
                                        }
                                      }}
                                    >
                                      <option value="">Pilih item PO...</option>
                                      {po.items.map((pi, pidx) => (
                                        <option key={pidx} value={pi.description}>
                                          [{pi.code || "-"}] {pi.description} (Order: {pi.orderedQty} {pi.orderedUnit})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tab 1: Komparasi PO & Status Rekonsiliasi */}
                      {activeSubTab === "COMPARISON" && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-semibold">
                              <tr>
                                <th className="px-3 py-2">Kode Item</th>
                                <th className="px-3 py-2">Item di PO Database vs File Incoming</th>
                                <th className="px-3 py-2 text-right">Dipesan (Base)</th>
                                <th className="px-3 py-2 text-right">Dipesan (Pkg)</th>
                                <th className="px-3 py-2 text-right">Diterima (Base)</th>
                                <th className="px-3 py-2 text-right">Diterima (Pkg)</th>
                                <th className="px-3 py-2 text-center">Progress</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">No. Surat Jalan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {po.items.map((item, idx) => {
                                const ist = ITEM_STATUS_CONFIG[item.status];
                                const isDiscrepancyRow = item.status === "PENDING" && unmatchedCount > 0;

                                return (
                                  <tr
                                    key={idx}
                                    className={`hover:bg-slate-50/80 transition-colors ${
                                      isDiscrepancyRow ? "bg-amber-50/30" : ""
                                    }`}
                                  >
                                    <td className="px-3 py-2 font-mono text-slate-700 font-semibold whitespace-nowrap">
                                      {item.code || <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-slate-800 max-w-sm">
                                      <div className="font-semibold text-slate-900">{item.description}</div>
                                      {item.incomingDescription ? (
                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                          {item.matchType === "ALIAS" ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                              Alias Cocok
                                            </span>
                                          ) : item.matchType === "FUZZY" ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                              Fuzzy {item.matchScore}%
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              Cocok
                                            </span>
                                          )}
                                          <span className="text-[10px] text-slate-500 italic truncate" title={`Nama di Excel: ${item.incomingDescription}`}>
                                            Di Excel: &ldquo;{item.incomingDescription}&rdquo;
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleUnmatchItem(po.poNumber, item.description)}
                                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer"
                                            title="Lepas pencocokan jika bukan barang ini"
                                          >
                                            <Unlink className="w-2.5 h-2.5" /> Lepas
                                          </button>
                                        </div>
                                      ) : isDiscrepancyRow ? (
                                        <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                                          ⚠️ Belum ada penerimaan (kemungkinan beda nama dengan item incoming di atas)
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {item.orderedQty.toLocaleString("id-ID")} <span className="text-slate-400">{item.orderedUnit}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700 font-semibold">
                                      {item.packageQty != null
                                        ? <>{item.packageQty.toLocaleString("id-ID")} <span className="text-slate-400 font-normal">{item.packageUnit || "pkg"}</span></>
                                        : <span className="text-slate-300">—</span>
                                      }
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                      {item.receivedQty.toLocaleString("id-ID")} <span className="text-slate-400 font-normal">{item.orderedUnit}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                                      {item.receivedPackageQty != null
                                        ? <>{item.receivedPackageQty.toLocaleString("id-ID")} <span className="text-slate-400 font-normal">{item.packageUnit || "pkg"}</span></>
                                        : <span className="text-slate-300">—</span>
                                      }
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2 justify-center">
                                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${
                                              item.completionPct >= 100 ? "bg-emerald-500" :
                                              item.completionPct > 0 ? "bg-amber-400" :
                                              "bg-slate-300"
                                            }`}
                                            style={{ width: `${Math.min(100, item.completionPct)}%` }}
                                          />
                                        </div>
                                        <span className="text-slate-600 text-[11px] font-bold">{item.completionPct}%</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      <Badge color={ist.color}>{ist.label}</Badge>
                                    </td>
                                    <td className="px-3 py-2 text-slate-500 text-[11px]">
                                      {item.suratJalans.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {item.suratJalans.map((sj, i) => (
                                            <span key={i} className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                              {sj}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Tab 2: Daftar Seluruh Data Fisik Masuk di File Excel */}
                      {activeSubTab === "INCOMING_LIST" && (
                        <div className="p-3">
                          <div className="mb-2 text-xs font-semibold text-slate-700 flex items-center gap-2">
                            <ListFilter className="w-4 h-4 text-indigo-600" />
                            Seluruh Baris Barang yang Tercatat di File Incoming untuk PO {po.poNumber}:
                          </div>
                          <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-semibold">
                                <tr>
                                  <th className="px-3 py-2">Kode di Excel</th>
                                  <th className="px-3 py-2">Nama Part di Excel</th>
                                  <th className="px-3 py-2 text-right">Total Qty Masuk</th>
                                  <th className="px-3 py-2">Surat Jalan</th>
                                  <th className="px-3 py-2">Status Terhubung ke PO</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {po.allIncomingItems && po.allIncomingItems.length > 0 ? (
                                  po.allIncomingItems.map((inc, iidx) => (
                                    <tr key={iidx} className="hover:bg-slate-50">
                                      <td className="px-3 py-2 font-mono font-bold text-slate-700">
                                        {inc.code || "—"}
                                      </td>
                                      <td className="px-3 py-2 font-medium text-slate-900">
                                        {inc.description}
                                      </td>
                                      <td className="px-3 py-2 text-right font-bold text-indigo-700">
                                        {inc.receivedQty.toLocaleString("id-ID")} {inc.unit}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                        {inc.suratJalans.join(", ") || "—"}
                                      </td>
                                      <td className="px-3 py-2">
                                        {inc.isMatched ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cocok dengan PO
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Beda Nama / Tak Cocok
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                                      Tidak ada data item fisik incoming.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Sukses Commit ke Database */}
      {commitSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Incoming Berhasil Diinput ke Database!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Data penerimaan fisik dari file incoming telah berhasil dicatat ke sistem dan status PO diperbarui otomatis.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Purchase Orders Terupdate:</span>
                <span className="font-bold text-slate-900">{commitSuccessModal.updatedPOs} PO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Surat Jalan (Deliveries) Dibuat:</span>
                <span className="font-bold text-slate-900">{commitSuccessModal.createdDeliveries} Dokumen</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Penerimaan (Receivings) Dicatat:</span>
                <span className="font-bold text-slate-900">{commitSuccessModal.createdReceivings} Transaksi</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push("/purchasing/purchase-orders")}
                className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                Lihat Daftar PO <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCommitSuccessModal(null)}
                className="py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
