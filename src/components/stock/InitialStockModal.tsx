"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Save,
  Search,
  Warehouse as WarehouseIcon,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  Info,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface InitialStockItemRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  packageUnit: string;
  packageSize: number;
  departmentScope: string | null;
  departments: string[];
  initialStockId: string | null;
  packageQty: number;
  baseQty: number;
  cutoffDate: string | null;
  notes: string;
  updatedAt: string | null;
  createdByName: string | null;
}

interface InitialStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouses: WarehouseOption[];
  currentWarehouseId: string;
}

export default function InitialStockModal({
  isOpen,
  onClose,
  onSuccess,
  warehouses,
  currentWarehouseId,
}: InitialStockModalProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [cutoffDate, setCutoffDate] = useState<string>("");
  const [items, setItems] = useState<InitialStockItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [hasOnlyNonZero, setHasOnlyNonZero] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Set initial selected warehouse & today's date
  useEffect(() => {
    if (isOpen) {
      const targetWh =
        currentWarehouseId && currentWarehouseId !== "all"
          ? currentWarehouseId
          : warehouses[0]?.id || "";
      setSelectedWarehouseId(targetWh);

      const today = new Date().toISOString().split("T")[0];
      setCutoffDate(today);
      setFeedback(null);
      setSearch("");
    }
  }, [isOpen, currentWarehouseId, warehouses]);

  // Load items & existing initial stock when warehouse changes
  useEffect(() => {
    if (!isOpen || !selectedWarehouseId) return;

    async function loadInitialStockData() {
      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch(`/api/stock/initial?warehouseId=${selectedWarehouseId}`);
        if (!res.ok) throw new Error("Gagal memuat data saldo awal");
        const data = await res.json();
        if (data.items) {
          setItems(data.items);
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Gagal memuat data" });
      } finally {
        setLoading(false);
      }
    }

    loadInitialStockData();
  }, [isOpen, selectedWarehouseId]);

  // Handle local change in package qty or notes
  const handleQtyChange = (itemId: string, newPkgQty: number) => {
    const val = Math.max(0, isNaN(newPkgQty) ? 0 : newPkgQty);
    setItems((prev) =>
      prev.map((it) => {
        if (it.itemId === itemId) {
          const base = Math.round(val * it.packageSize * 100) / 100;
          return {
            ...it,
            packageQty: val,
            baseQty: base,
          };
        }
        return it;
      })
    );
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((it) => (it.itemId === itemId ? { ...it, notes } : it))
    );
  };

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (hasOnlyNonZero && it.packageQty <= 0) return false;
      if (scopeFilter !== "ALL" && it.departmentScope !== scopeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const mCode = it.itemCode.toLowerCase().includes(q);
        const mName = it.itemName.toLowerCase().includes(q);
        if (!mCode && !mName) return false;
      }
      return true;
    });
  }, [items, search, scopeFilter, hasOnlyNonZero]);

  // Save initial stock
  const handleSave = async () => {
    if (!selectedWarehouseId) {
      setFeedback({ type: "error", message: "Pilih gudang terlebih dahulu" });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      // Kirim semua item yang diedit atau memiliki packageQty >= 0
      const payload = {
        warehouseId: selectedWarehouseId,
        cutoffDate,
        stocks: items.map((it) => ({
          itemId: it.itemId,
          packageQty: it.packageQty,
          baseQty: it.baseQty,
          notes: it.notes,
        })),
      };

      const res = await fetch("/api/stock/initial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Gagal menyimpan saldo awal");
      }

      setFeedback({
        type: "success",
        message: resData.message || "Saldo awal gudang berhasil disimpan!",
      });

      // Beritahu parent component untuk refresh
      onSuccess();

      // Tutup otomatis setelah jeda singkat
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Terjadi kesalahan saat menyimpan" });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalFilled = items.filter((it) => it.packageQty > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Atur Saldo Awal Gudang (Beginning Stock / Opname)
              </h2>
              <p className="text-xs text-slate-500">
                Tentukan stok awal fisik barang di gudang sebelum mutasi penerimaan & pengeluaran berjalan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Controls Bar */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Warehouse Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <WarehouseIcon className="w-3.5 h-3.5 text-blue-600" />
                Gudang Lokasi:
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                disabled={loading || saving}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Cut-off Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Tanggal Cut-Off Saldo:
              </label>
              <input
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                disabled={saving}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                Cari Barang:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik kode atau nama barang..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Filter Scope:</span>
              <button
                type="button"
                onClick={() => setScopeFilter("ALL")}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  scopeFilter === "ALL"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("PRODUCTION")}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  scopeFilter === "PRODUCTION"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Produksi
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("INDIRECT")}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  scopeFilter === "INDIRECT"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Indirect
              </button>

              <label className="flex items-center gap-1.5 ml-3 text-[11px] text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasOnlyNonZero}
                  onChange={(e) => setHasOnlyNonZero(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                Hanya tampilkan stok &gt; 0
              </label>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              Total terisi: <span className="font-bold text-blue-700">{totalFilled}</span> dari{" "}
              {items.length} item
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center gap-2 border-b ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
              <p className="text-xs">Memuat data barang & saldo awal...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-semibold text-slate-600">Tidak ada barang yang cocok</p>
              <p className="text-[11px] mt-0.5">Coba ubah kata kunci pencarian atau filter scope</p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-semibold select-none shadow-xs">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Barang &amp; Spesifikasi</th>
                  <th className="py-2.5 px-3 w-32">Kemasan &amp; Konversi</th>
                  <th className="py-2.5 px-3 w-40 text-center">Saldo Awal (Kemasan)</th>
                  <th className="py-2.5 px-3 w-36 text-center">Setara Satuan Dasar</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Catatan / Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((it, idx) => (
                  <tr
                    key={it.itemId}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      it.packageQty > 0 ? "bg-blue-50/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{it.itemCode}</div>
                      <div className="text-slate-600 line-clamp-1">{it.itemName}</div>
                      {it.departmentScope && (
                        <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-500">
                          {it.departmentScope}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div className="font-medium text-slate-800">{it.packageUnit}</div>
                      <div className="text-[10px] text-slate-400">
                        1 {it.packageUnit} = {it.packageSize} {it.unit}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="relative inline-block w-full max-w-[130px]">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={it.packageQty === 0 ? "" : it.packageQty}
                          onChange={(e) =>
                            handleQtyChange(it.itemId, parseFloat(e.target.value) || 0)
                          }
                          placeholder="0"
                          disabled={saving}
                          className="w-full font-mono text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 px-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">
                          {it.packageUnit}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700 font-semibold">
                      <span>{it.baseQty.toLocaleString("id-ID")}</span>{" "}
                      <span className="text-[10px] font-normal text-slate-500">{it.unit}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={it.notes}
                        onChange={(e) => handleNotesChange(it.itemId, e.target.value)}
                        placeholder="Contoh: Opname fisik awal..."
                        disabled={saving}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>
              Saldo awal akan otomatis menjadi basis kartu stok dan laporan mutasi bulanan gudang.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving} className="text-xs">
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || loading}
              className="text-xs gap-1.5 shadow-sm"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Simpan Saldo Awal
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
