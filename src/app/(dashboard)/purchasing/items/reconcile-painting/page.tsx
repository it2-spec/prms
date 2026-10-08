"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Search,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Filter,
  CheckCheck,
  Download,
} from "lucide-react";
import { Card, PageTitle, Button, Badge } from "@/components/ui";

type MasterItemBrief = {
  id: string;
  code: string;
  name: string;
  paintingCode?: string | null;
  packageUnit?: string | null;
  unit?: string | null;
};

type ReconcileRow = {
  rowIndex: number;
  paintingCode: string;
  paintingName: string;
  paintingUnit?: string;
  matchedItem: {
    id: string;
    code: string;
    name: string;
    currentPaintingCode?: string | null;
    unit?: string | null;
    packageUnit?: string | null;
  } | null;
  matchType: "EXACT_CODE" | "EXACT_NAME" | "FUZZY_HIGH" | "FUZZY_MEDIUM" | "NONE";
  matchScore: number;
  status: "MATCHED" | "REVIEW" | "UNMATCHED";
  // User manual override flag
  isManualOverride?: boolean;
};

type PreviewResponse = {
  success: boolean;
  summary: {
    totalRows: number;
    matchedCount: number;
    reviewCount: number;
    unmatchedCount: number;
  };
  results: ReconcileRow[];
  allMasterItems: MasterItemBrief[];
};

export default function ReconcilePaintingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const res = await fetch("/api/master/items/reconcile-painting/template");
      if (!res.ok) throw new Error("Gagal mengunduh template Excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template_Rekonsiliasi_Kode_Painting.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "Gagal mengunduh template");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [rows, setRows] = useState<ReconcileRow[]>([]);
  const [allMasterItems, setAllMasterItems] = useState<MasterItemBrief[]>([]);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<"ALL" | "REVIEW" | "UNMATCHED" | "MATCHED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal manual item picker
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);

      const res = await fetch("/api/master/items/reconcile-painting", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses file Excel");

      setPreviewData(data);
      setRows(data.results || []);
      setAllMasterItems(data.allMasterItems || []);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memproses file");
      setFile(null);
    } finally {
      setLoading(false);
    }
  }

  // Pilih item master secara manual untuk baris tertentu
  function handleAssignItem(rowIndex: number, item: MasterItemBrief) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex === rowIndex) {
          return {
            ...r,
            matchedItem: {
              id: item.id,
              code: item.code,
              name: item.name,
              currentPaintingCode: item.paintingCode,
              unit: item.unit,
              packageUnit: item.packageUnit,
            },
            matchType: "EXACT_NAME",
            matchScore: 100,
            status: "MATCHED",
            isManualOverride: true,
          };
        }
        return r;
      })
    );
    setPickerRowIndex(null);
    setPickerSearch("");
  }

  // Lepaskan pasangan item (Unlink)
  function handleUnlinkItem(rowIndex: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex === rowIndex) {
          return {
            ...r,
            matchedItem: null,
            matchType: "NONE",
            matchScore: 0,
            status: "UNMATCHED",
            isManualOverride: true,
          };
        }
        return r;
      })
    );
  }

  // Commit / Simpan perubahan ke database
  async function handleCommit() {
    const validPairs = rows
      .filter((r) => r.matchedItem && r.paintingCode)
      .map((r) => ({
        paintingCode: r.paintingCode,
        targetItemId: r.matchedItem!.id,
      }));

    if (validPairs.length === 0) {
      alert("Tidak ada item yang dipasangkan untuk disimpan.");
      return;
    }

    if (
      !confirm(
        `Terapkan ${validPairs.length} kode painting ke Master Item? Kode ini akan langsung tersimpan di database.`
      )
    ) {
      return;
    }

    setCommitLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/master/items/reconcile-painting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: validPairs }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pemetaan kode painting");

      setSuccessMsg(data.message || `Berhasil memperbarui ${data.updatedCount} kode item painting!`);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan data ke server");
    } finally {
      setCommitLoading(false);
    }
  }

  // Filtered rows
  const filteredRows = rows.filter((r) => {
    // Filter tab
    if (activeTab === "REVIEW" && r.status !== "REVIEW") return false;
    if (activeTab === "UNMATCHED" && r.status !== "UNMATCHED") return false;
    if (activeTab === "MATCHED" && r.status !== "MATCHED") return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = r.paintingCode.toLowerCase().includes(q);
      const nameMatch = r.paintingName.toLowerCase().includes(q);
      const matchedCodeMatch = r.matchedItem?.code.toLowerCase().includes(q);
      const matchedNameMatch = r.matchedItem?.name.toLowerCase().includes(q);
      return codeMatch || nameMatch || matchedCodeMatch || matchedNameMatch;
    }

    return true;
  });

  const matchedCount = rows.filter((r) => r.status === "MATCHED").length;
  const reviewCount = rows.filter((r) => r.status === "REVIEW").length;
  const unmatchedCount = rows.filter((r) => r.status === "UNMATCHED").length;

  // Filtered items in manual picker modal
  const pickerTargetRow = rows.find((r) => r.rowIndex === pickerRowIndex);
  const filteredPickerItems = allMasterItems.filter((i) => {
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.toLowerCase();
    return (
      i.code.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      (i.paintingCode && i.paintingCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <PageTitle
        title="Rekonsiliasi Kode Item Painting"
        subtitle="Cocokkan format kode & nama part dari Departemen Painting dengan Master Item PRMS menggunakan Fuzzy Matching"
        breadcrumb={["Master Data", "Item", "Rekonsiliasi Painting"]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="gap-2 text-xs border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 font-semibold"
            >
              <Download className="w-4 h-4 text-teal-600" />
              {downloadingTemplate ? "Mengunduh..." : "Download Template Excel"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/purchasing/items")}
              className="gap-2 text-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Master Item
            </Button>
          </div>
        }
      />

      {/* Alert Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Alert Sukses */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-emerald-900">Pembaruan Selesai!</div>
              <div className="text-emerald-700 text-xs mt-0.5">{successMsg}</div>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => router.push("/purchasing/items")}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            Lihat di Master Item &rarr;
          </Button>
        </div>
      )}

      {/* UPLOAD SECTION (JIKA BELUM ADA DATA ATAU INGIN GANTI FILE) */}
      {!previewData && (
        <Card bodyClassName="!p-8">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-xs">
              <FileSpreadsheet className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Upload Berkas Excel Painting</h3>
              <p className="text-xs text-slate-500 mt-1">
                Unggah daftar master atau laporan part dari Departemen Painting (.xlsx / .xls).
                Sistem akan secara otomatis mendeteksi kolom <strong>Kode Painting</strong> dan <strong>Nama Barang</strong>.
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50/50 hover:bg-teal-50/30 rounded-2xl p-8 cursor-pointer transition-all space-y-3"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Klik di sini untuk memilih berkas Excel
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Format .xlsx atau .xls</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Panduan Visual Format Tabel Excel yang Dibutuhkan */}
            <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs text-teal-950 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                  <span>Format Kolom Excel yang Dibutuhkan:</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="text-[11px] text-teal-700 hover:text-teal-900 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template (.xlsx)
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-teal-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-teal-700 text-white font-semibold text-[11px]">
                    <tr>
                      <th className="px-3 py-2 text-center whitespace-nowrap">Kolom A (Wajib)</th>
                      <th className="px-3 py-2 whitespace-nowrap">Kolom B (Wajib)</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">Kolom C (Opsional)</th>
                      <th className="px-3 py-2 whitespace-nowrap">Kolom D (Opsional)</th>
                    </tr>
                    <tr className="bg-teal-800/90 text-teal-100 text-[10px]">
                      <th className="px-3 py-1 text-center font-mono">Kode Painting (Gudang)</th>
                      <th className="px-3 py-1">Nama Barang Painting</th>
                      <th className="px-3 py-1 text-center">Kemasan</th>
                      <th className="px-3 py-1">Keterangan / Lokasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    <tr className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center font-bold text-teal-700">PTG-CSH18-04</td>
                      <td className="px-3 py-2 font-sans text-slate-800">Pikanet Eco CSH18008 Silver SR No. 4</td>
                      <td className="px-3 py-2 text-center text-slate-500 font-sans">Pail 18 kg</td>
                      <td className="px-3 py-2 text-slate-400 font-sans text-[10px]">Stock Plant 2</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center font-bold text-teal-700">PTG-THIN-WASH</td>
                      <td className="px-3 py-2 font-sans text-slate-800">Washing Thinner PP</td>
                      <td className="px-3 py-2 text-center text-slate-500 font-sans">Pail 15 kg</td>
                      <td className="px-3 py-2 text-slate-400 font-sans text-[10px]">Area Cuci Jig</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1">
                <p>
                  💡 <strong>Catatan:</strong> Di dalam berkas template yang Anda unduh, lembar kedua (<strong>Referensi Master Item PRMS</strong>) sudah terisi otomatis dengan seluruh daftar part Master Item PRMS saat ini untuk mempermudah pengecekan Anda.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-left text-xs text-blue-900 space-y-1.5 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-blue-950">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Cara Kerja Smart Fuzzy Matching:
              </div>
              <ul className="list-disc list-inside space-y-1 text-blue-800 text-[11px]">
                <li>Pencocokan nama part toleran terhadap perbedaan spasi, urutan kata, dan tanda baca.</li>
                <li>Mendeteksi kesamaan kode SKU dan mencegah pencocokan warna/nomor seri yang bertentangan.</li>
                <li>Setiap baris dilengkapi skor kecocokan (%) dan pemilih manual untuk verifikasi.</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* DASHBOARD HASIL REKONSILIASI */}
      {previewData && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{rows.length}</div>
                <div className="text-xs text-slate-500 font-medium">Total Item Painting</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-700">{matchedCount}</div>
                <div className="text-xs text-slate-500 font-medium">Cocok Otomatis</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-amber-700">{reviewCount}</div>
                <div className="text-xs text-slate-500 font-medium">Perlu Ditinjau</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-rose-700">{unmatchedCount}</div>
                <div className="text-xs text-slate-500 font-medium">Belum Terhubung</div>
              </div>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("REVIEW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "REVIEW"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                Perlu Ditinjau ({reviewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("UNMATCHED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "UNMATCHED"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                Belum Terhubung ({unmatchedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("MATCHED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "MATCHED"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Sudah Cocok ({matchedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode atau nama..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreviewData(null);
                  setRows([]);
                  setFile(null);
                }}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 whitespace-nowrap cursor-pointer"
                title="Unggah file lain"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Ganti File
              </button>
            </div>
          </div>

          {/* Interactive Reconcile Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">No</th>
                    <th className="px-4 py-3 w-1/3">Item Departemen Painting (Excel)</th>
                    <th className="px-4 py-3 w-1/3">Target Master Item PRMS (Purchasing)</th>
                    <th className="px-4 py-3 text-center">Skor & Tipe Kecocokan</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada data item yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => (
                      <tr
                        key={r.rowIndex}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          r.status === "MATCHED"
                            ? "bg-emerald-50/20"
                            : r.status === "REVIEW"
                            ? "bg-amber-50/30"
                            : "bg-rose-50/20"
                        }`}
                      >
                        {/* No */}
                        <td className="px-4 py-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Data Painting */}
                        <td className="px-4 py-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-[11px]">
                              {r.paintingCode || "(Tanpa Kode)"}
                            </span>
                            {r.paintingUnit && (
                              <span className="text-[10px] text-slate-400">
                                ({r.paintingUnit})
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-slate-900 text-xs">
                            {r.paintingName}
                          </div>
                        </td>

                        {/* Target Master Item PRMS */}
                        <td className="px-4 py-3">
                          {r.matchedItem ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                                  {r.matchedItem.code}
                                </span>
                                {r.matchedItem.currentPaintingCode && (
                                  <span className="text-[10px] text-slate-500">
                                    Painting saat ini: <strong>{r.matchedItem.currentPaintingCode}</strong>
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-slate-800 text-xs line-clamp-2">
                                {r.matchedItem.name}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-rose-600 bg-rose-50/80 px-3 py-2 rounded-lg border border-rose-200/70">
                              <XCircle className="w-4 h-4 shrink-0" />
                              <span className="font-medium text-xs">Belum ada item yang cocok</span>
                            </div>
                          )}
                        </td>

                        {/* Skor & Tipe Kecocokan */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {r.matchType === "EXACT_CODE" && (
                            <Badge color="green">KODE COCOK 100%</Badge>
                          )}
                          {r.matchType === "EXACT_NAME" && (
                            <Badge color="green">NAMA PERSIS 100%</Badge>
                          )}
                          {r.matchType === "FUZZY_HIGH" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Sparkles className="w-3 h-3" /> FUZZY {r.matchScore}%
                            </span>
                          )}
                          {r.matchType === "FUZZY_MEDIUM" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3" /> REVIEW {r.matchScore}%
                            </span>
                          )}
                          {r.matchType === "NONE" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                              Tidak Ada Kecocokan
                            </span>
                          )}

                          {r.isManualOverride && (
                            <div className="text-[10px] text-blue-600 font-semibold mt-1">
                              (Pilihan Manual)
                            </div>
                          )}
                        </td>

                        {/* Aksi Baris */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPickerRowIndex(r.rowIndex);
                                setPickerSearch(r.paintingName);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                            >
                              {r.matchedItem ? "Ganti" : "Pilih Item"}
                            </button>

                            {r.matchedItem && (
                              <button
                                type="button"
                                onClick={() => handleUnlinkItem(r.rowIndex)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Lepas pasangan"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Toolbar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Menampilkan <strong>{filteredRows.length}</strong> dari <strong>{rows.length}</strong> item painting.
                <span className="ml-2 text-emerald-700 font-semibold">
                  ({matchedCount} siap diterapkan)
                </span>
              </div>

              <Button
                variant="primary"
                onClick={handleCommit}
                disabled={commitLoading || matchedCount === 0}
                className="gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              >
                {commitLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menyimpan ke Master Item...
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    Terapkan {matchedCount} Kode Painting ke Master Item
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PEMILIH MASTER ITEM SECARA MANUAL ────────────────────────── */}
      {pickerRowIndex !== null && pickerTargetRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pilih Master Item PRMS
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Untuk part painting: <strong>{pickerTargetRow.paintingName}</strong> ({pickerTargetRow.paintingCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerRowIndex(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Ketik kode atau nama master item..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                />
              </div>
            </div>

            {/* Master Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredPickerItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Tidak ada master item yang cocok dengan pencarian.
                </div>
              ) : (
                filteredPickerItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAssignItem(pickerRowIndex, item)}
                    className="p-3 hover:bg-blue-50/60 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                          {item.code}
                        </span>
                        {item.paintingCode && (
                          <span className="text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 font-mono">
                            Painting: {item.paintingCode}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {item.name}
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      className="text-xs group-hover:bg-blue-600 group-hover:text-white shrink-0"
                    >
                      Pilih
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setPickerRowIndex(null)}
                className="text-xs"
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
