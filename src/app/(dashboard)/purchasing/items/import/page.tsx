"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Package,
  Save,
  RefreshCw,
  Trash2,
  Info,
} from "lucide-react";
import { Card, PageTitle, Badge, Button } from "@/components/ui";

type ParsedItem = {
  name: string;
  packageUnit: string | null;
  packageSize: number | null;
  unit: string | null;
  lastUnitPrice: number | null;
};

type ImportMode = "upsert" | "skip_existing" | "overwrite";

const formatRp = (val: number | null) =>
  val == null ? "—" : "Rp " + val.toLocaleString("id-ID");

export default function ImportItemsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("upsert");

  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [search, setSearch] = useState("");

  const [commitResult, setCommitResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    message: string;
  } | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setLoading(true);
    setError(null);
    setParsedItems(null);
    setCommitResult(null);

    try {
      const fd = new FormData();
      fd.append("file", selected);

      const res = await fetch("/api/master/items/parse-excel", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Gagal membaca file Excel");
        return;
      }

      setParsedItems(data.items);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!parsedItems || parsedItems.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/master/items/commit-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsedItems, mode }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Gagal menyimpan item");
        return;
      }

      setCommitResult(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setFile(null);
    setParsedItems(null);
    setCommitResult(null);
    setError(null);
    setSearch("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const filteredItems = (parsedItems ?? []).filter(
    (i) =>
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.packageUnit ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Import Master Item dari Excel"
        subtitle="Upload file Excel untuk memasukkan data item secara massal"
        breadcrumb={["Master Data", "Item", "Import Excel"]}
        action={
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => router.push("/purchasing/items")}
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Master Item
          </Button>
        }
      />

      {/* ── Step 1: Upload File ───────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Upload File Excel</p>
            <p className="text-xs text-slate-500">Format kolom: DESCRIPTIONS | package unit | package size | unit | harga /kg</p>
          </div>
        </div>

        {/* Format Info */}
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-3">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-semibold mb-1">Format Excel yang Didukung:</p>
            <table className="text-xs">
              <thead>
                <tr className="text-blue-500">
                  <th className="text-left pr-4 font-semibold">DESCRIPTIONS</th>
                  <th className="text-left pr-4 font-semibold">package unit</th>
                  <th className="text-left pr-4 font-semibold">package size</th>
                  <th className="text-left pr-4 font-semibold">unit</th>
                  <th className="text-left font-semibold">harga /kg</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-4">ECONET Thinner #P135...</td>
                  <td className="pr-4">pail</td>
                  <td className="pr-4">15</td>
                  <td className="pr-4">lt</td>
                  <td>123.996</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {!parsedItems && !loading && !commitResult && (
          <label
            htmlFor="file-import-items"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-xl py-10 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Klik untuk memilih file Excel</p>
              <p className="text-xs text-slate-400 mt-1">Format: .xlsx atau .xls</p>
            </div>
            <input
              ref={fileInputRef}
              id="file-import-items"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-10">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm text-slate-600">Membaca file Excel...</span>
          </div>
        )}

        {file && parsedItems && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800 truncate">{file.name}</p>
              <p className="text-xs text-emerald-600">{parsedItems.length} item berhasil dibaca dari file</p>
            </div>
            <button onClick={handleReset} className="p-1.5 hover:bg-emerald-100 rounded-lg" title="Ganti file">
              <Trash2 className="w-4 h-4 text-emerald-500" />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}
      </Card>

      {/* ── Step 2: Preview + Import Mode ────────────────────────────────── */}
      {parsedItems && !commitResult && (
        <>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">Pengaturan Import</p>
                <p className="text-xs text-slate-500">Pilih apa yang terjadi jika item sudah ada</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  {
                    key: "upsert" as ImportMode,
                    label: "Update & Tambah",
                    desc: "Item baru dibuat, item yang sudah ada diperbarui (nama, kemasan, harga)",
                    color: "blue",
                  },
                  {
                    key: "skip_existing" as ImportMode,
                    label: "Hanya Tambah Baru",
                    desc: "Hanya item baru yang dibuat, item yang sudah ada dilewati",
                    color: "emerald",
                  },
                  {
                    key: "overwrite" as ImportMode,
                    label: "Timpa Semua",
                    desc: "Semua data diperbarui, termasuk menimpa harga yang sudah ada",
                    color: "amber",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    mode === opt.key
                      ? "border-primary bg-primary/5"
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      mode === opt.key ? "bg-primary border-primary" : "border-slate-300"
                    }`} />
                    <p className="text-xs font-semibold text-slate-800">{opt.label}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">Preview Data ({parsedItems.length} item)</p>
                <p className="text-xs text-slate-500">Review data sebelum disimpan</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-3 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100 mb-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Descriptions</th>
                    <th className="px-3 py-2.5 text-center">Package Unit</th>
                    <th className="px-3 py-2.5 text-center">Package Size</th>
                    <th className="px-3 py-2.5 text-center">Unit</th>
                    <th className="px-3 py-2.5 text-right">Harga /Unit</th>
                    <th className="px-3 py-2.5 text-right">Harga /Kemasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-xs">
                        Tidak ada item ditemukan
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const hargaKemasan =
                        item.lastUnitPrice != null && item.packageSize != null
                          ? item.lastUnitPrice * item.packageSize
                          : null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-xs">
                            <div className="truncate" title={item.name}>{item.name}</div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.packageUnit ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold capitalize">
                                {item.packageUnit}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-xs text-slate-700">
                            {item.packageSize ?? <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.unit ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                {item.unit}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-slate-800 whitespace-nowrap">
                            {formatRp(item.lastUnitPrice)}
                            {item.unit && item.lastUnitPrice != null && (
                              <span className="text-slate-400 ml-0.5">/{item.unit}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                            {hargaKemasan != null ? (
                              <span className="text-slate-700">
                                {formatRp(hargaKemasan)}
                                <span className="text-slate-400 ml-0.5">/{item.packageUnit || "kemasan"}</span>
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Total: <strong>{parsedItems.length}</strong> item akan diproses
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleReset} disabled={saving}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Ganti File
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCommit}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Simpan {parsedItems.length} Item</>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {commitResult && (
        <Card className="p-6">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Import Berhasil!</h3>
              <p className="text-sm text-slate-500 mt-1">{commitResult.message}</p>
            </div>
            <div className="flex gap-4">
              <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-emerald-700">{commitResult.created}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Item Baru</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-blue-700">{commitResult.updated}</p>
                <p className="text-xs text-blue-600 mt-0.5">Diperbarui</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-slate-500">{commitResult.skipped}</p>
                <p className="text-xs text-slate-400 mt-0.5">Dilewati</p>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" onClick={handleReset}>
                <Upload className="w-4 h-4 mr-1" /> Import File Lain
              </Button>
              <Button variant="primary" onClick={() => router.push("/purchasing/items")}>
                <Package className="w-4 h-4 mr-1" /> Lihat Master Item
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
