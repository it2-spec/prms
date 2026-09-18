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
  Truck,
  FileCheck,
} from "lucide-react";
import { Card, PageTitle, Badge, Button } from "@/components/ui";

type IncomingRow = {
  poNumber: string;
  itemName: string;
  packageUnit: string;
  packageSize: number;
  qty: number;
  unit: string;
  unitPrice: number;
  supplierName: string;
  poDate: string;
  receivedQty: number;
  suratJalan: string;
  receiveDate: string;
};

const formatRp = (val: number | null) =>
  val == null ? "—" : "Rp " + val.toLocaleString("id-ID");

export default function ImportIncomingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsedData, setParsedData] = useState<{
    rows: IncomingRow[];
    totalRows: number;
    totalPOs: number;
    totalSJs: number;
    totalItems: number;
  } | null>(null);

  const [search, setSearch] = useState("");

  const [commitResult, setCommitResult] = useState<{
    createdPOs: number;
    createdDeliveries: number;
    createdReceivings: number;
    message: string;
  } | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setLoading(true);
    setError(null);
    setParsedData(null);
    setCommitResult(null);

    try {
      const fd = new FormData();
      fd.append("file", selected);

      const res = await fetch("/api/master/incoming/parse-excel", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Gagal membaca file Excel incoming");
        return;
      }

      setParsedData(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat membaca file");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!parsedData || parsedData.rows.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/master/incoming/commit-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedData.rows }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Gagal menyimpan transaksi incoming");
        return;
      }

      setCommitResult(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyimpan data");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setFile(null);
    setParsedData(null);
    setCommitResult(null);
    setError(null);
    setSearch("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const filteredRows = (parsedData?.rows ?? []).filter(
    (r) =>
      !search ||
      r.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.itemName.toLowerCase().includes(search.toLowerCase()) ||
      r.suratJalan.toLowerCase().includes(search.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Import Incoming Transactions dari Excel"
        subtitle="Upload file Excel transaksi pengiriman & penerimaan (PO, Delivery, Receiving) massal"
        breadcrumb={["Deliveries", "Import Incoming Excel"]}
        action={
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => router.push("/purchasing/deliveries")}
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Deliveries
          </Button>
        }
      />

      {/* Step 1: Upload */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Upload File Excel (incoming copy.xlsx)</p>
            <p className="text-xs text-slate-500">Format: PO NO | DESCRIPTIONS | package unit | unit/can | QTY | UNIT | UNIT PRICE | SUPPLIER | NO SURAT JALAN | RECEIVE DATE</p>
          </div>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-3">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Sistem Otomatis:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Auto-create Item & Supplier yang belum ada di Master Data</li>
              <li>Auto-create Purchase Order (Status: CLOSED)</li>
              <li>Auto-create Delivery (Surat Jalan) & Receiving Gudang</li>
              <li>Split otomatis jika 1 Surat Jalan berisi item dari beberapa PO berlainan</li>
            </ul>
          </div>
        </div>

        {!parsedData && !loading && !commitResult && (
          <label
            htmlFor="file-import-incoming"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-xl py-10 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Klik untuk memilih file Excel Incoming</p>
              <p className="text-xs text-slate-400 mt-1">Format: .xlsx atau .xls (incoming copy.xlsx)</p>
            </div>
            <input
              ref={fileInputRef}
              id="file-import-incoming"
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
            <span className="text-sm text-slate-600">Membaca data Excel incoming...</span>
          </div>
        )}

        {file && parsedData && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800 truncate">{file.name}</p>
              <p className="text-xs text-emerald-600">
                Terdeteksi: <strong>{parsedData.totalRows}</strong> Transaksi · <strong>{parsedData.totalPOs}</strong> PO · <strong>{parsedData.totalSJs}</strong> Surat Jalan · <strong>{parsedData.totalItems}</strong> Item Unik
              </p>
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

      {/* Step 2: Preview & Confirm */}
      {parsedData && !commitResult && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">Preview Data Transaksi ({parsedData.totalRows} baris)</p>
              <p className="text-xs text-slate-500">Periksa sampel data transaksi sebelum di-commit</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Cari PO, Item, SJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-3 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100 mb-4 max-h-96">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider font-semibold sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">No. PO</th>
                  <th className="px-3 py-2.5">No. Surat Jalan</th>
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Qty Kirim/Terima</th>
                  <th className="px-3 py-2.5 text-right">Harga /Unit</th>
                  <th className="px-3 py-2.5">Supplier</th>
                  <th className="px-3 py-2.5">Tgl Terima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.slice(0, 100).map((r, idx) => {
                  const pkgSize = r.packageSize || 20;
                  const pkgQty = Math.floor(r.qty / pkgSize);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-800">{r.poNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{r.suratJalan}</td>
                      <td className="px-3 py-2 font-medium text-slate-800 max-w-xs truncate" title={r.itemName}>
                        {r.itemName}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-900">
                        {r.qty} {r.unit}
                        <span className="text-slate-400 block text-[10px]">({pkgQty} {r.packageUnit})</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">
                        {formatRp(r.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[150px]">{r.supplierName}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                        {new Date(r.receiveDate).toLocaleDateString("id-ID")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 100 && (
            <p className="text-xs text-slate-400 italic text-center mb-4">
              Menampilkan 100 dari {filteredRows.length} baris data...
            </p>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Total: <strong>{parsedData.totalPOs}</strong> PO, <strong>{parsedData.totalSJs}</strong> Surat Jalan akan diproses.
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
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses Import...</>
                ) : (
                  <><Save className="w-4 h-4" /> Import {parsedData.totalRows} Transaksi</>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Result */}
      {commitResult && (
        <Card className="p-6">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Import Incoming Berhasil!</h3>
              <p className="text-sm text-slate-500 mt-1">{commitResult.message}</p>
            </div>
            <div className="flex gap-4">
              <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-center min-w-[100px]">
                <p className="text-2xl font-bold text-blue-700">{commitResult.createdPOs}</p>
                <p className="text-xs text-blue-600 mt-0.5">PO Dibuat</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center min-w-[100px]">
                <p className="text-2xl font-bold text-emerald-700">{commitResult.createdDeliveries}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Delivery Dibuat</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-purple-50 border border-purple-100 text-center min-w-[100px]">
                <p className="text-2xl font-bold text-purple-700">{commitResult.createdReceivings}</p>
                <p className="text-xs text-purple-600 mt-0.5">Receiving Dibuat</p>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" onClick={handleReset}>
                <Upload className="w-4 h-4 mr-1" /> Import File Lain
              </Button>
              <Button variant="primary" onClick={() => router.push("/purchasing/deliveries")}>
                <Truck className="w-4 h-4 mr-1" /> Lihat Daftar Deliveries
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
