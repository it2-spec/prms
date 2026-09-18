"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageTitle, Card, Badge, Button, statusColor } from "@/components/ui";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  History,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  FileSpreadsheet,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";

type ItemData = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  packageUnit: string | null;
  packageSize: number | null;
  lastUnitPrice: number | null;
  description: string | null;
  isActive: boolean;
  _count?: { priceHistories: number };
};

type PriceHistory = {
  id: string;
  oldUnitPrice: number | null;
  newUnitPrice: number;
  source: string | null;
  changedAt: string;
};

type LinkedTransactions = {
  purchaseOrders?: Array<{
    id: string;
    poNumber: string;
    status: string;
    poDate?: string;
    supplierName?: string;
    qty?: number;
  }>;
  deliveries?: Array<{
    id: string;
    deliveryNumber: string;
    suratJalan: string;
    shipDate?: string;
    qty?: number;
  }>;
  receivings?: Array<{
    id: string;
    receivingNumber: string;
    receivedAt?: string;
    qty?: number;
  }>;
};

const formatRp = (val: number | null | undefined) =>
  val == null ? "—" : "Rp " + val.toLocaleString("id-ID");

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemData | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    unit: "kg",
    packageUnit: "Pail",
    packageSize: "15",
    lastUnitPrice: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete modal UI states
  const [deleteTarget, setDeleteTarget] = useState<ItemData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLinkedTx, setDeleteLinkedTx] = useState<LinkedTransactions | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  // Price history modal
  const [historyItem, setHistoryItem] = useState<ItemData | null>(null);
  const [historyData, setHistoryData] = useState<PriceHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Export Excel
  const [exporting, setExporting] = useState(false);
  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/master/items/export");
      if (!res.ok) throw new Error("Gagal mengunduh file Excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `master-item-prms-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "Gagal mengekspor file Excel");
    } finally {
      setExporting(false);
    }
  }

  // Update Kode via Excel
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeFile, setCodeFile] = useState<File | null>(null);
  const [codePreviewLoading, setCodePreviewLoading] = useState(false);
  const [codeCommitLoading, setCodeCommitLoading] = useState(false);
  const [codePreviewData, setCodePreviewData] = useState<{
    summary: { totalRows: number; validCount: number; duplicateCount: number; unchangedCount: number };
    items: { itemId: string; itemName: string; oldCode: string; newCode: string; status: string; message?: string }[];
  } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState<string | null>(null);

  async function handleCodeFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCodeFile(file);
    setCodePreviewLoading(true);
    setCodeError(null);
    setCodeSuccessMsg(null);
    setCodePreviewData(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("action", "preview");

      const res = await fetch("/api/master/items/update-codes", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Gagal membaca file Excel");
      }
      setCodePreviewData(data);
    } catch (err: any) {
      setCodeError(err.message || "Gagal memproses file");
    } finally {
      setCodePreviewLoading(false);
    }
  }

  async function handleCommitCodeUpdates() {
    if (!codeFile) return;
    setCodeCommitLoading(true);
    setCodeError(null);
    try {
      const fd = new FormData();
      fd.append("file", codeFile);
      fd.append("action", "commit");

      const res = await fetch("/api/master/items/update-codes", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Gagal memperbarui kode item");
      }
      setCodeSuccessMsg(data.message || "Berhasil memperbarui kode item!");
      setCodePreviewData(null);
      setCodeFile(null);
      loadItems();
    } catch (err: any) {
      setCodeError(err.message || "Gagal menyimpan perubahan kode");
    } finally {
      setCodeCommitLoading(false);
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/master/items");
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function handleOpenCreate() {
    setEditingItem(null);
    setFormData({
      code: "",
      name: "",
      unit: "kg",
      packageUnit: "Pail",
      packageSize: "15",
      lastUnitPrice: "",
      description: "",
    });
    setError(null);
    setShowModal(true);
  }

  function handleOpenEdit(item: ItemData) {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      unit: item.unit || "kg",
      packageUnit: item.packageUnit || "Pail",
      packageSize: item.packageSize ? String(item.packageSize) : "1",
      lastUnitPrice: item.lastUnitPrice ? String(item.lastUnitPrice) : "",
      description: item.description || "",
    });
    setError(null);
    setShowModal(true);
  }

  async function handleOpenHistory(item: ItemData) {
    setHistoryItem(item);
    setHistoryData([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/master/items/price-history?itemId=${item.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setHistoryData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = "/api/master/items";
      const method = editingItem ? "PUT" : "POST";
      const body = editingItem
        ? { id: editingItem.id, ...formData, isActive: editingItem.isActive }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan item");

      setShowModal(false);
      loadItems();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(item: ItemData) {
    try {
      await fetch("/api/master/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, isActive: !item.isActive }),
      });
      loadItems();
    } catch (e) {
      console.error(e);
    }
  }

  function handleOpenDelete(item: ItemData) {
    setDeleteTarget(item);
    setDeleteError(null);
    setDeleteLinkedTx(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    setDeleteLinkedTx(null);
    try {
      const res = await fetch(`/api/master/items?id=${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus item");
        if (data.transactions) {
          setDeleteLinkedTx(data.transactions);
        }
        setDeleting(false);
        return;
      }

      setToastSuccess(`Item ${deleteTarget.code} — ${deleteTarget.name} berhasil dihapus.`);
      setTimeout(() => setToastSuccess(null), 5000);
      setDeleteTarget(null);
      setDeleteLinkedTx(null);
      loadItems();
    } catch (e: any) {
      setDeleteError(e?.message || "Terjadi kesalahan saat menghubungi server");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeactivateFromModal() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/master/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...deleteTarget, isActive: false }),
      });
      setToastSuccess(`Status item ${deleteTarget.code} berhasil diubah menjadi Non-Aktif.`);
      setTimeout(() => setToastSuccess(null), 5000);
      setDeleteTarget(null);
      setDeleteLinkedTx(null);
      loadItems();
    } catch (e: any) {
      setDeleteError(e?.message || "Gagal menonaktifkan item");
    } finally {
      setDeleting(false);
    }
  }

  const filteredItems = items.filter(
    (i) =>
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.unit && i.unit.toLowerCase().includes(search.toLowerCase()))
  );

  // Computed: harga per kemasan
  function hargaPerKemasan(item: ItemData): number | null {
    if (item.lastUnitPrice == null || item.packageSize == null) return null;
    return Number(item.lastUnitPrice) * Number(item.packageSize);
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Master Item"
        subtitle="Kelola master data barang & material"
        breadcrumb={["Master Data", "Item"]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleExportExcel}
              disabled={exporting}
              variant="secondary"
              className="gap-2 text-xs"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              {exporting ? "Mengekspor..." : "Export Excel"}
            </Button>
            <Button
              onClick={() => {
                setShowCodeModal(true);
                setCodePreviewData(null);
                setCodeError(null);
                setCodeSuccessMsg(null);
                setCodeFile(null);
              }}
              variant="secondary"
              className="gap-2 text-xs"
            >
              <Upload className="w-4 h-4 text-blue-600" /> Update Kode via Excel
            </Button>
            <Button
              onClick={() => router.push("/purchasing/items/import")}
              variant="secondary"
              className="gap-2 text-xs"
            >
              <FileSpreadsheet className="w-4 h-4" /> Import Excel
            </Button>
            <Button onClick={handleOpenCreate} variant="primary" className="gap-2 text-xs">
              <Plus className="w-4 h-4" /> Tambah Item
            </Button>
          </div>
        }
      />

      {/* Toast Notifikasi Sukses */}
      {toastSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between gap-3 text-emerald-800 text-xs shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastSuccess}</span>
          </div>
          <button
            onClick={() => setToastSuccess(null)}
            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode atau nama item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">Total: {filteredItems.length} Item</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Kode</th>
                <th className="px-4 py-3 whitespace-nowrap">Descriptions</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Package Unit</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Package Size</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Unit</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Harga /kg</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Harga /Kemasan</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Status</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Memuat data item...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada item ditemukan.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const hargaKemasan = hargaPerKemasan(item);
                  const histCount = item._count?.priceHistories ?? 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {item.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                        {item.description && (
                          <div className="text-xs text-slate-400 mt-0.5">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold">
                          {item.packageUnit || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700 text-xs">
                        {item.packageSize != null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 font-mono">
                            {Number(item.packageSize)} {item.unit || "kg"}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold">
                          {item.unit || "—"}
                        </span>
                      </td>
                      <td
                        onClick={() => handleOpenEdit(item)}
                        className="px-4 py-3 text-right font-mono text-slate-800 hover:text-blue-600 text-xs whitespace-nowrap cursor-pointer transition-colors"
                        title="Klik untuk ubah harga / edit item"
                      >
                        {formatRp(item.lastUnitPrice)}
                        {item.unit && item.lastUnitPrice != null && (
                          <span className="text-slate-400 ml-0.5">/{item.unit}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800 text-xs whitespace-nowrap">
                        {hargaKemasan != null ? (
                          <>
                            {formatRp(hargaKemasan)}
                            <span className="text-slate-400 ml-0.5">/{item.packageUnit || "kemasan"}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={item.isActive ? "green" : "red"}>
                          {item.isActive ? "Aktif" : "Non-Aktif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* History harga */}
                          <button
                            onClick={() => handleOpenHistory(item)}
                            className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 relative"
                            title={`History Harga (${histCount} perubahan)`}
                          >
                            <History className="w-4 h-4" />
                            {histCount > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-violet-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                                {histCount > 9 ? "9+" : histCount}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleStatus(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            title={item.isActive ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {item.isActive ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit Item & Update Harga"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(item)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal Form Add/Edit ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? "Edit Item" : "Tambah Item Baru"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {error && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Item *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Contoh: ITM-001"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Item (Descriptions) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Washing Thinner PP"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Kemasan Info */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-2">Informasi Kemasan</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Package Unit</label>
                    <input
                      type="text"
                      value={formData.packageUnit}
                      onChange={(e) => setFormData({ ...formData, packageUnit: e.target.value })}
                      placeholder="Pail / Can / Drum"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Package Size</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.packageSize}
                      onChange={(e) => setFormData({ ...formData, packageSize: e.target.value })}
                      placeholder="15"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Unit (Satuan Bobot)</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="kg / ltr"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-2">
                  ➜ 1 {formData.packageUnit || "Pail"} = {formData.packageSize || "15"} {formData.unit || "kg"}
                </p>
              </div>

              {/* Harga Info */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-900">Update Harga Satuan (Manual / Auto dari PO)</p>
                  <span className="text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium">
                    Tercatat di History Harga
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Harga Satuan per {formData.unit || "kg"} (Rp)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.lastUnitPrice}
                    onChange={(e) => setFormData({ ...formData, lastUnitPrice: e.target.value })}
                    placeholder="Contoh: 45000"
                    className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/20 font-mono text-slate-800"
                  />
                  {formData.lastUnitPrice && formData.packageSize && (
                    <p className="text-[11px] text-amber-800 font-medium mt-1.5 flex items-center gap-1">
                      <span>➜ Estimasi Harga per {formData.packageUnit || "Kemasan"}:</span>
                      <strong className="font-mono text-slate-900">
                        Rp {(Number(formData.lastUnitPrice) * Number(formData.packageSize)).toLocaleString("id-ID")}
                      </strong>
                    </p>
                  )}
                  <p className="text-[11px] text-amber-700/80 mt-1 leading-relaxed">
                    Anda dapat mengubah harga di sini secara manual kapan saja. Perubahan harga akan otomatis tercatat ke dalam <strong>History Perubahan Harga</strong> item ini.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Keterangan tambahan item..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal History Harga ─────────────────────────────────────────────── */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">History Harga</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {historyItem.code} — {historyItem.name}
                </p>
              </div>
              <button onClick={() => setHistoryItem(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Harga terkini */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <div>
                <p className="text-xs text-emerald-600 font-semibold">Harga Terkini</p>
                <p className="text-base font-bold text-emerald-800 font-mono">
                  {formatRp(historyItem.lastUnitPrice)}/{historyItem.unit || "kg"}
                </p>
                {historyItem.lastUnitPrice != null && historyItem.packageSize != null && (
                  <p className="text-xs text-emerald-600 font-mono">
                    = {formatRp(Number(historyItem.lastUnitPrice) * Number(historyItem.packageSize))}/{historyItem.packageUnit || "kemasan"}
                  </p>
                )}
              </div>
            </div>

            {/* Daftar riwayat */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {historyLoading ? (
                <p className="text-center text-sm text-slate-400 py-8">Memuat riwayat harga...</p>
              ) : historyData.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">
                  Belum ada riwayat perubahan harga.<br />
                  <span className="text-xs">Harga akan otomatis tercatat saat upload Batch PO.</span>
                </p>
              ) : (
                historyData.map((h, idx) => {
                  const oldPrice = h.oldUnitPrice != null ? Number(h.oldUnitPrice) : null;
                  const newPrice = Number(h.newUnitPrice);
                  const isUp = oldPrice != null && newPrice > oldPrice;
                  const isDown = oldPrice != null && newPrice < oldPrice;
                  return (
                    <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                      <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${isUp ? "bg-rose-100" : isDown ? "bg-emerald-100" : "bg-slate-100"}`}>
                        {isUp ? (
                          <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                        ) : isDown ? (
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500 line-through">
                            {oldPrice != null ? formatRp(oldPrice) : "Harga baru"}
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className={`font-mono text-sm font-bold ${isUp ? "text-rose-600" : isDown ? "text-emerald-600" : "text-slate-700"}`}>
                            {formatRp(newPrice)}
                          </span>
                          <span className="text-slate-400 text-xs">/{historyItem.unit || "kg"}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-violet-600 font-medium">{h.source || "—"}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(h.changedAt).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                      </div>
                      {idx === 0 && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                          Terkini
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setHistoryItem(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Update Kode via Excel ──────────────────────────────────────── */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Update Kode Master Item Massal</h3>
                  <p className="text-xs text-slate-500">Ganti kode item (misal ITM-AUTO-xxx) tanpa mengubah nama barang dari PO</p>
                </div>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* Info Box */}
              <div className="rounded-xl bg-blue-50/80 border border-blue-200/80 p-3.5 text-xs text-blue-900 space-y-1 leading-relaxed">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  Petunjuk Pembaruan Kode Item:
                </p>
                <ol className="list-decimal list-inside text-blue-800 space-y-0.5 ml-1">
                  <li>Unduh file master item melalui tombol <strong>Export Excel</strong>.</li>
                  <li>Isi kolom <strong>Kode Baru</strong> pada baris item yang ingin diubah.</li>
                  <li>Unggah kembali file Excel tersebut pada formulir di bawah ini.</li>
                  <li><strong>Nama Barang & Riwayat PO tetap dipertahankan 100%</strong> karena sistem memperbarui berdasarkan ID unik item.</li>
                </ol>
              </div>

              {codeError && (
                <div className="alert alert-danger flex items-center gap-2 py-2.5 text-xs" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{codeError}</span>
                </div>
              )}

              {codeSuccessMsg && (
                <div className="alert alert-success flex items-center gap-2 py-2.5 text-xs" role="alert">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{codeSuccessMsg}</span>
                </div>
              )}

              {/* Upload Input Box */}
              {!codePreviewData && !codeSuccessMsg && (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                  <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Pilih File Excel Hasil Edit</p>
                  <p className="text-[11px] text-slate-500 mb-3">Format .xlsx atau .xls dengan kolom Kode Baru</p>
                  
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    id="update-code-file-input"
                    className="hidden"
                    onChange={handleCodeFileSelect}
                  />
                  <label
                    htmlFor="update-code-file-input"
                    className={`btn btn-primary btn-sm text-xs gap-1.5 cursor-pointer ${
                      codePreviewLoading ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {codePreviewLoading ? "Membaca & Memvalidasi..." : "Pilih File Excel"}
                  </label>
                </div>
              )}

              {/* Preview Table */}
              {codePreviewData && (
                <div className="space-y-3">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                      <div className="font-bold text-emerald-800 text-sm">{codePreviewData.summary.validCount}</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">Siap Diupdate</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="font-bold text-slate-700 text-sm">{codePreviewData.summary.unchangedCount}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">Kode Sama/Kosong</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                      <div className="font-bold text-rose-800 text-sm">{codePreviewData.summary.duplicateCount}</div>
                      <div className="text-[10px] text-rose-600 font-semibold">Duplikat / Konflik</div>
                    </div>
                  </div>

                  {/* List of Changes */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="p-2">Nama Barang (Tetap dari PO)</th>
                          <th className="p-2">Kode Sekarang</th>
                          <th className="p-2">Kode Baru</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {codePreviewData.items.map((it, idx) => (
                          <tr key={idx} className={it.status === "VALID" ? "bg-emerald-50/40" : it.status === "DUPLICATE" ? "bg-rose-50/40" : ""}>
                            <td className="p-2 font-medium text-slate-800 max-w-[200px] truncate" title={it.itemName}>
                              {it.itemName}
                            </td>
                            <td className="p-2 font-mono text-slate-500 line-through text-[11px]">
                              {it.oldCode}
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-900 text-[11px]">
                              {it.status === "VALID" ? (
                                <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  {it.newCode}
                                </span>
                              ) : (
                                it.newCode || "—"
                              )}
                            </td>
                            <td className="p-2 text-center whitespace-nowrap">
                              {it.status === "VALID" && <Badge color="green">Valid</Badge>}
                              {it.status === "DUPLICATE" && <Badge color="red">Duplikat</Badge>}
                              {it.status === "UNCHANGED" && <Badge color="slate">Tidak Berubah</Badge>}
                              {it.status === "NOT_FOUND" && <Badge color="amber">Tidak Ditemukan</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCodePreviewData(null);
                        setCodeFile(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Ganti file Excel lain
                    </button>
                    <span className="text-[11px] text-slate-500">
                      File: <strong>{codeFile?.name}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <Button
                variant="secondary"
                onClick={() => setShowCodeModal(false)}
                className="text-xs"
              >
                {codeSuccessMsg ? "Selesai" : "Tutup"}
              </Button>

              {codePreviewData && codePreviewData.summary.validCount > 0 && (
                <Button
                  onClick={handleCommitCodeUpdates}
                  disabled={codeCommitLoading}
                  variant="primary"
                  className="gap-2 text-xs font-bold"
                >
                  <CheckCircle className="w-4 h-4" />
                  {codeCommitLoading
                    ? "Menerapkan Perubahan..."
                    : `Terapkan ${codePreviewData.summary.validCount} Kode Baru`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Konfirmasi Hapus Item UI ──────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-xs">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Master Item?</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Anda akan menghapus data item barang berikut dari database master.
                </p>
              </div>
            </div>

            {/* Rincian Item Card */}
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Kode Item</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {deleteTarget.code}
                </span>
              </div>
              <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Nama Barang</span>
                <span className="font-semibold text-slate-800 text-right max-w-[240px]">
                  {deleteTarget.name}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Spesifikasi Kemasan</span>
                <span className="text-slate-700 font-medium">
                  {deleteTarget.packageSize ? `${Number(deleteTarget.packageSize)} ${deleteTarget.unit || "kg"}` : "—"}{" "}
                  / {deleteTarget.packageUnit || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Harga Master Terakhir</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatRp(deleteTarget.lastUnitPrice)}
                </span>
              </div>
            </div>

            {/* Alert Peringatan & Proteksi */}
            {!deleteLinkedTx && (
              <div className="rounded-xl bg-amber-50/80 p-3 text-xs text-amber-900 border border-amber-200/80 leading-relaxed">
                <div className="font-semibold text-amber-950 mb-0.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Proteksi Integritas Transaksi</span>
                </div>
                <p className="text-[11px] text-amber-900/90">
                  Item yang sudah pernah tercatat dalam transaksi Purchase Order (PO), Pengiriman (Delivery), atau Penerimaan (Receiving) dilindungi oleh sistem dan tidak dapat dihapus permanen. Untuk item tersebut, Anda dapat memilih untuk <strong>menonaktifkannya</strong> saja.
                </p>
              </div>
            )}

            {/* Error Alert jika delete gagal */}
            {deleteError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{deleteError}</div>
              </div>
            )}

            {/* Daftar Transaksi PO yang Terikat (LENGKAP DENGAN HREF KLIK LANGSUNG) */}
            {deleteLinkedTx?.purchaseOrders && deleteLinkedTx.purchaseOrders.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Item Tercatat di {deleteLinkedTx.purchaseOrders.length} Purchase Order:
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded border border-blue-200">
                    Klik No PO untuk buka
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {deleteLinkedTx.purchaseOrders.map((po) => (
                    <Link
                      key={po.id}
                      href={`/purchasing/purchase-orders/${po.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-blue-200/80 hover:border-blue-400 hover:bg-blue-50/80 transition-all text-xs group shadow-2xs"
                      title={`Buka ${po.poNumber} di tab baru`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-blue-600 group-hover:underline">
                          <span>{po.poNumber}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-blue-500 opacity-70 group-hover:opacity-100" />
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Supplier: {po.supplierName || "-"}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge color={statusColor(po.status)}>{po.status}</Badge>
                        <div className="font-mono text-[10px] text-slate-400">
                          Qty: {po.qty ?? 0}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="rounded-lg bg-white/80 p-2.5 border border-blue-200/60 text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-blue-950 flex items-center gap-1">
                    💡 <span>Cara Hapus Item Ini:</span>
                  </p>
                  <p className="leading-snug">
                    Klik tautan nomor PO di atas untuk membuka dokumen tersebut di tab baru. Bila status PO masih <strong>DRAFT</strong> atau <strong>REVISI</strong>, Anda dapat merevisi atau menghapus baris item dari PO tersebut terlebih dahulu.
                  </p>
                </div>
              </div>
            )}

            {/* Transaksi Pengiriman / Penerimaan Lain (jika ada) */}
            {((deleteLinkedTx?.deliveries && deleteLinkedTx.deliveries.length > 0) ||
              (deleteLinkedTx?.receivings && deleteLinkedTx.receivings.length > 0)) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5 text-slate-700">
                <div className="font-semibold text-slate-900 text-xs">
                  Riwayat Pengiriman &amp; Penerimaan Fisik:
                </div>
                {deleteLinkedTx.deliveries && deleteLinkedTx.deliveries.length > 0 && (
                  <p className="text-[11px]">
                    📦 Tercatat di {deleteLinkedTx.deliveries.length} Surat Jalan Delivery ({deleteLinkedTx.deliveries.map(d => d.suratJalan || d.deliveryNumber).slice(0, 3).join(", ")})
                  </p>
                )}
                {deleteLinkedTx.receivings && deleteLinkedTx.receivings.length > 0 && (
                  <p className="text-[11px]">
                    🏢 Tercatat di {deleteLinkedTx.receivings.length} Bukti Penerimaan Gudang ({deleteLinkedTx.receivings.map(r => r.receivingNumber).slice(0, 3).join(", ")})
                  </p>
                )}
                <p className="text-[10px] text-slate-500 italic">
                  Catatan: Data fisik pengiriman yang sudah tiba di gudang tidak dapat dihapus untuk menjaga riwayat stok.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              {deleteLinkedTx ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeactivateFromModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  title="Ubah status item menjadi Non-Aktif tanpa menghapus histori PO"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Nonaktifkan Item Saja</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                    setDeleteLinkedTx(null);
                  }}
                >
                  {deleteLinkedTx ? "Tutup" : "Batal"}
                </Button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>{deleteLinkedTx ? "Coba Hapus Lagi" : "Ya, Hapus Item"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
