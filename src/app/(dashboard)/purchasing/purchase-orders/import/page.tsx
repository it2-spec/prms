"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Building2,
  Package,
  Layers,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
} from "lucide-react";
import { Card, PageTitle, Badge } from "@/components/ui";

type ParsedItem = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  packageQty: number | null;
  packageUnit: string | null;
  packageSize: number | null;
  itemStatus: "EXISTING" | "NEW_AUTO_CREATE";
  matchedItemId: string;
  suggestedItemCode: string;
  suggestedItemName: string;
};

type ParsedPO = {
  poNumber: string;
  poDate: string | null;
  supplierName: string;
  supplierStatus: "EXISTING" | "NEW_AUTO_CREATE";
  matchedSupplierId: string;
  suggestedSupplierCode: string;
  suggestedSupplierName: string;
  supplierAddress?: string | null;
  supplierPhone?: string | null;
  supplierContactPerson?: string | null;
  warehouseName?: string | null;
  department?: string | null;
  purposeProject?: string | null;
  isDuplicateInDb: boolean;
  items: ParsedItem[];
};

type Summary = {
  totalPOs: number;
  totalItems: number;
  totalNewSuppliers: number;
  totalNewItems: number;
  totalDuplicates: number;
};

export default function ImportBatchPOPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{ summary: Summary; pos: ParsedPO[] } | null>(null);
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});
  const [commitResult, setCommitResult] = useState<{ createdPoCount: number; createdItemCount: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function togglePOExpand(poNum: string) {
    setExpandedPOs((prev) => ({ ...prev, [poNum]: !prev[poNum] }));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    setFiles(selected);
    setLoading(true);
    setError(null);
    setParsedData(null);
    setCommitResult(null);

    try {
      const fd = new FormData();
      for (const f of selected) fd.append("file", f);

      const res = await fetch("/api/parse-po-rekap", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Gagal mengurai file Rekap Excel");
        setLoading(false);
        return;
      }

      setParsedData({ summary: data.summary, pos: data.pos });

      // Expand all POs by default for easy review
      const initialExpand: Record<string, boolean> = {};
      data.pos.forEach((p: ParsedPO) => {
        initialExpand[p.poNumber] = true;
      });
      setExpandedPOs(initialExpand);
    } catch (err: any) {
      setError("Terjadi kesalahan koneksi saat membaca file Excel.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!parsedData || parsedData.pos.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/commit-po-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pos: parsedData.pos }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Gagal menyimpan batch PO");
        setSaving(false);
        return;
      }

      setCommitResult({
        createdPoCount: data.createdPoCount,
        createdItemCount: data.createdItemCount,
      });
    } catch (err: any) {
      setError("Gagal menyimpan data PO ke database.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle
        title="Batch Import Rekap PO (Excel)"
        subtitle="Unggah 1 file Rekap Excel untuk mengimpor banyak PO sekaligus ke sistem"
        breadcrumb={["Purchase Orders", "Batch Import"]}
        action={
          <button
            onClick={() => router.push("/purchasing/purchase-orders")}
            className="btn btn-light text-xs gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
        }
      />

      {/* Step 1: Upload Section */}
      {!parsedData && !commitResult && (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-bold text-slate-800">Unggah File Rekap PO Excel</h3>
              <p className="text-xs text-slate-500">
                Pilih satu atau beberapa file Excel PO (.xlsx) sekaligus untuk diproses dalam satu batch.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger flex items-center gap-2 max-w-lg w-full text-left" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="batch-excel-upload"
              />
              <label
                htmlFor="batch-excel-upload"
                className={`btn btn-primary text-sm px-6 py-2.5 gap-2 shadow-md ${
                  loading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <Upload className="w-4 h-4" />
                {loading ? "Membaca & Memetakan Data Excel..." : "Pilih File Excel PO (Multi)"}
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Success Screen */}
      {commitResult && (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Batch PO Berhasil Disimpan!</h3>
              <p className="text-sm text-slate-500">
                Berhasil mengimpor <strong>{commitResult.createdPoCount} PO</strong> dan membuat <strong>{commitResult.createdItemCount} item baru</strong> di database.
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setParsedData(null);
                  setCommitResult(null);
                  setFiles([]);
                }}
                className="btn btn-light text-xs gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> Import Rekap Lain
              </button>
              <button
                onClick={() => router.push("/purchasing/purchase-orders")}
                className="btn btn-primary text-xs"
              >
                Lihat Daftar PO
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Interactive Preview & Mapping Table */}
      {parsedData && !commitResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {error && (
            <div className="alert alert-danger flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Total PO</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{parsedData.summary.totalPOs}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>Total Item</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{parsedData.summary.totalItems}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>Supplier Baru</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{parsedData.summary.totalNewSuppliers}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Package className="w-4 h-4 text-amber-600" />
                <span>Item Baru</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{parsedData.summary.totalNewItems}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>PO Duplikat</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{parsedData.summary.totalDuplicates}</p>
            </div>
          </div>

          {/* PO List Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Hasil Pemetaan & Preview PO</h3>
              <span className="text-xs text-slate-500">
                File: <strong>{files.map(f => f.name).join(", ")}</strong>
              </span>
            </div>

            {parsedData.pos.map((po) => (
              <div
                key={po.poNumber}
                className={`bg-white rounded-xl border transition-all ${
                  po.isDuplicateInDb ? "border-red-200 bg-red-50/20" : "border-slate-200 shadow-sm"
                }`}
              >
                {/* PO Header Bar */}
                <div
                  onClick={() => togglePOExpand(po.poNumber)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 rounded-xl"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">{po.poNumber}</span>
                      {po.isDuplicateInDb ? (
                        <Badge color="red">PO Duplikat (Akan Diewati)</Badge>
                      ) : (
                        <Badge color="green">Siap Import</Badge>
                      )}
                      {po.supplierStatus === "NEW_AUTO_CREATE" ? (
                        <Badge color="purple">Supplier Baru: {po.suggestedSupplierName}</Badge>
                      ) : (
                        <Badge color="slate">Supplier: {po.supplierName}</Badge>
                      )}
                      {po.poDate && (
                        <Badge color="blue">Tgl PO: {po.poDate}</Badge>
                      )}
                      {po.warehouseName && (
                        <Badge color="amber">Warehouse: {po.warehouseName}</Badge>
                      )}
                      {(po as any).sourceFile && (
                        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                          📄 {(po as any).sourceFile}
                        </span>
                      )}
                    </div>
                    {(po.supplierContactPerson || po.supplierPhone || po.supplierAddress || po.purposeProject || po.department) && (
                      <div className="text-xs text-slate-500 flex flex-col gap-0.5">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {po.supplierContactPerson && <span><strong>Attn:</strong> {po.supplierContactPerson}</span>}
                          {po.supplierPhone && <span><strong>Telp:</strong> {po.supplierPhone}</span>}
                          {po.department && <span><strong>Dept:</strong> {po.department}</span>}
                          {po.purposeProject && <span><strong>Project/Purpose:</strong> {po.purposeProject}</span>}
                        </div>
                        {po.supplierAddress && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xl">
                            <strong>Alamat:</strong> {po.supplierAddress}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    <span>{po.items.length} item</span>
                    {expandedPOs[po.poNumber] ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* PO Item Breakdown Table */}
                {expandedPOs[po.poNumber] && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-xl">
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="px-3 py-2">No</th>
                            <th className="px-3 py-2">Teks Barang di Excel</th>
                            <th className="px-3 py-2">Pemetaan Status Master</th>
                            <th className="px-3 py-2 text-right">Qty (base)</th>
                            <th className="px-3 py-2">Satuan</th>
                            <th className="px-3 py-2 text-right">Qty (pkg)</th>
                            <th className="px-3 py-2">Kemasan</th>
                            <th className="px-3 py-2 text-right">Harga Satuan</th>
                            <th className="px-3 py-2 text-right">Total Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {po.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{it.description}</td>
                              <td className="px-3 py-2">
                                {it.itemStatus === "EXISTING" ? (
                                  <Badge color="green">Terhubung Master Item</Badge>
                                ) : (
                                  <Badge color="amber">Item Baru ({it.suggestedItemCode})</Badge>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">{it.qty.toLocaleString("id-ID")}</td>
                              <td className="px-3 py-2 font-medium text-slate-600">{it.unit}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                                {it.packageQty != null ? it.packageQty.toLocaleString("id-ID") : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-500">
                                {it.packageUnit
                                  ? <span className="capitalize">{it.packageUnit}{it.packageSize ? <span className="text-[10px] text-slate-400 ml-1">(×{it.packageSize})</span> : null}</span>
                                  : <span className="text-slate-300">—</span>
                                }
                              </td>
                              <td className="px-3 py-2 text-right">Rp {it.unitPrice.toLocaleString("id-ID")}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                Rp {(it.qty * it.unitPrice).toLocaleString("id-ID")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Footer Bar */}
          <div className="sticky bottom-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xl flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => { setParsedData(null); setFiles([]); }}
              className="btn btn-light text-xs"
              disabled={saving}
            >
              Batal & Upload Ulang
            </button>

            <button
              type="button"
              onClick={handleCommit}
              disabled={saving || parsedData.pos.length === 0}
              className="btn btn-primary text-sm px-6 py-2.5 gap-2 shadow-md"
            >
              <Save className="w-4 h-4" />
              {saving ? "Memproses & Menyimpan Batch PO..." : `Simpan & Import ${parsedData.summary.totalPOs - parsedData.summary.totalDuplicates} PO`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
