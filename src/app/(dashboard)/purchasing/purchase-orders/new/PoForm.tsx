"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Calendar,
  Building2,
  Lock,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import MultiSelect from "@/components/MultiSelect";

export type ItemOption = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  packageUnit: string | null;
  packageSize: number | null;
  lastUnitPrice: number;
};

export type SupplierOption = {
  id: string;
  code?: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
};

export type WarehouseOption = {
  id: string;
  code?: string;
  name: string;
};

export type DeptOption = {
  id: string;
  code: string;
  name: string;
};

interface PoFormProps {
  suggestedPoNumber?: string;
  departments?: DeptOption[];
  items: ItemOption[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  createPo: (formData: FormData) => Promise<{ error?: string; redirect?: string }>;
}

const DEFAULT_DEPTS = [
  "Painting Plant 1",
  "Painting Plant 2",
  "Injection Moulding",
  "Assembly",
  "Production Preparation",
  "Quality Control / QA",
  "Maintenance / Engineering",
  "Warehouse & Logistic",
  "Production Planning & Inventory Control",
  "Purchasing",
  "General Affair & HR",
];

function angkaTerbilang(nilai: number): string {
  const bilangan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima",
    "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
  ];
  const n = Math.floor(Math.abs(nilai));
  if (n < 12) return bilangan[n];
  if (n < 20) return angkaTerbilang(n - 10) + " Belas";
  if (n < 100) return angkaTerbilang(Math.floor(n / 10)) + " Puluh " + angkaTerbilang(n % 10);
  if (n < 200) return "Seratus " + angkaTerbilang(n - 100);
  if (n < 1000) return angkaTerbilang(Math.floor(n / 100)) + " Ratus " + angkaTerbilang(n % 100);
  if (n < 2000) return "Seribu " + angkaTerbilang(n - 1000);
  if (n < 1000000) return angkaTerbilang(Math.floor(n / 1000)) + " Ribu " + angkaTerbilang(n % 1000);
  if (n < 1000000000) return angkaTerbilang(Math.floor(n / 1000000)) + " Juta " + angkaTerbilang(n % 1000000);
  if (n < 1000000000000) return angkaTerbilang(Math.floor(n / 1000000000)) + " Miliar " + angkaTerbilang(n % 1000000000);
  return angkaTerbilang(Math.floor(n / 1000000000000)) + " Triliun " + angkaTerbilang(n % 1000000000000);
}

function formatTerbilang(nilai: number): string {
  if (nilai <= 0) return "Nol Rupiah";
  const hasil = angkaTerbilang(nilai).replace(/\s+/g, " ").trim();
  return `${hasil} Rupiah`;
}

export default function PoForm({
  suggestedPoNumber,
  departments = [],
  items,
  suppliers,
  warehouses,
  createPo,
}: PoFormProps) {
  // Semua inputan default dibuat KOSONG agar terlihat jelas mana yg sudah diinput & belum
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [purposeProject, setPurposeProject] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [deliveryDateType, setDeliveryDateType] = useState<"DATE" | "MONTH">("DATE");
  const [notes, setNotes] = useState("");
  const [includeVat, setIncludeVat] = useState(true);

  // Baris item pertama dimulai dalam kondisi kosong
  const [rows, setRows] = useState<
    {
      itemId: string;
      qty: number | string;
      packageQty: number | string;
      unitPrice: number | string;
    }[]
  >([
    {
      itemId: "",
      qty: "",
      packageQty: "",
      unitPrice: 0,
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hitung format nomor PO otomatis sesuai tanggal yang dipilih ([noUrut]/SRI/PUD/[BulanRomawi]/[Tahun])
  const displaySuggestedPo = (() => {
    if (!suggestedPoNumber) return "1162/SRI/PUD/IX/2026";
    if (!poDate) return suggestedPoNumber;

    const d = new Date(poDate);
    if (isNaN(d.getTime())) return suggestedPoNumber;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const romanMonth = [
      "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"
    ][month - 1] || "I";

    const parts = suggestedPoNumber.split("/");
    const origSeq = parts[0] || "1162";
    const origYear = parts[parts.length - 1] || "2026";

    // Jika tahun yang dipilih sama dengan tahun dasar saran
    if (String(year) === origYear) {
      return `${origSeq}/SRI/PUD/${romanMonth}/${year}`;
    } else {
      // Jika mulai tahun baru (misal 2027), no urut kembali ke 0001
      return `0001/SRI/PUD/${romanMonth}/${year}`;
    }
  })();

  // Daftar opsi 11 departemen
  const deptOptions = (departments && departments.length > 0
    ? departments
    : DEFAULT_DEPTS.map((d, i) => ({ id: String(i), code: d, name: d }))
  ).map((d) => ({
    value: d.name,
    label: d.name,
  }));

  function addRow() {
    setRows((r) => [
      ...r,
      {
        itemId: "",
        qty: "",
        packageQty: "",
        unitPrice: 0,
      },
    ]);
  }

  function updateRow(
    i: number,
    key: "itemId" | "qty" | "packageQty" | "unitPrice",
    value: string | number
  ) {
    setRows((r) =>
      r.map((row, idx) => {
        if (idx !== i) return row;
        const currentItem = items.find((it) => it.id === (key === "itemId" ? value : row.itemId));
        const pkgSize = currentItem?.packageSize ? Number(currentItem.packageSize) : null;
        const hasPackaging = Boolean(pkgSize && pkgSize > 0);

        if (key === "itemId") {
          const matched = items.find((it) => it.id === value);
          const mPkgSize = matched?.packageSize ? Number(matched.packageSize) : null;
          const mHasPkg = Boolean(mPkgSize && mPkgSize > 0);
          return {
            ...row,
            itemId: String(value),
            unitPrice: matched?.lastUnitPrice ?? 0,
            packageQty: mHasPkg ? 1 : "",
            qty: mHasPkg ? mPkgSize! : 1,
          };
        }

        if (key === "packageQty") {
          if (value === "") {
            return { ...row, packageQty: "", qty: "" };
          }
          const pkgQ = Math.max(0, Number(value) || 0);
          const calculatedBaseQty = hasPackaging ? Math.round(pkgQ * (pkgSize || 1)) : pkgQ;
          return {
            ...row,
            packageQty: pkgQ,
            qty: calculatedBaseQty,
          };
        }

        if (key === "qty") {
          // Jika item memiliki satuan kemasan (misal Pail), Qty Base DIKUNCI (read-only)
          // Perkalian harus bulat dari pail, tidak boleh diubah manual di satuan dasar
          if (hasPackaging) {
            return row;
          }
          if (value === "") {
            return { ...row, qty: "", packageQty: "" };
          }
          const baseQ = Math.max(0, Number(value) || 0);
          return {
            ...row,
            qty: baseQ,
            packageQty: baseQ,
          };
        }

        if (key === "unitPrice") {
          return {
            ...row,
            unitPrice: value === "" ? "" : Math.max(0, Number(value) || 0),
          };
        }

        return row;
      })
    );
  }

  function removeRow(i: number) {
    if (rows.length <= 1) return;
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const subtotal = rows.reduce(
    (s, r) => s + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0),
    0
  );
  const vatAmount = includeVat ? Math.round(subtotal * 0.11) : 0;
  const grandTotal = subtotal + vatAmount;
  const terbilangText = formatTerbilang(grandTotal);

  // Deteksi berapa item yang mengalami perubahan harga dari master item
  const priceChangedCount = rows.filter((r) => {
    if (!r.itemId) return false;
    const it = items.find((item) => item.id === r.itemId);
    const masterPrice = it?.lastUnitPrice ?? 0;
    const currentPrice = Number(r.unitPrice) || 0;
    return currentPrice > 0 && Math.abs(currentPrice - masterPrice) > 0.01;
  }).length;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/parse-po-excel", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Gagal mengolah file Excel PO");
        setExtracting(false);
        return;
      }

      if (data.poNumber) {
        setPoNumber(data.poNumber);
      }
      if (data.poDate) {
        const parsedD = new Date(data.poDate);
        if (!isNaN(parsedD.getTime())) {
          setPoDate(parsedD.toISOString().split("T")[0]);
        }
      }
      if (data.matchedSupplierId) {
        setSupplierId(data.matchedSupplierId);
      }

      // 1. Warehouse / Lokasi Tujuan
      if (data.matchedWarehouseId) {
        setWarehouseId(data.matchedWarehouseId);
      } else {
        // Fallback berdasarkan filename atau data location
        const nameUpper = file.name.toUpperCase();
        if (nameUpper.includes("PLANT 1") || nameUpper.includes("PLANT1")) {
          const w1 = warehouses.find((w) => (w.code ? w.code.toUpperCase().includes("PLANT1") : false) || w.name.toUpperCase().includes("PLANT 1"));
          if (w1) setWarehouseId(w1.id);
        } else if (nameUpper.includes("PLANT 2") || nameUpper.includes("PLANT2")) {
          const w2 = warehouses.find((w) => (w.code ? w.code.toUpperCase().includes("PLANT2") : false) || w.name.toUpperCase().includes("PLANT 2"));
          if (w2) setWarehouseId(w2.id);
        }
      }

      // 2. Use by Dept (Smart Mapping)
      const resolvedDepts: string[] = [];
      if (data.department) {
        const splitted = String(data.department)
          .split(/[,/;\n]+/)
          .map((d) => d.trim())
          .filter(Boolean);

        for (const inputDept of splitted) {
          const normInput = inputDept.toLowerCase().replace(/\s+/g, " ");
          const exact = deptOptions.find(
            (opt) => opt.value.toLowerCase() === normInput || opt.label.toLowerCase() === normInput
          );
          if (exact) {
            if (!resolvedDepts.includes(exact.value)) resolvedDepts.push(exact.value);
            continue;
          }
          const partial = deptOptions.find((opt) => {
            const optNorm = opt.value.toLowerCase();
            return optNorm.includes(normInput) || normInput.includes(optNorm);
          });
          if (partial) {
            if (!resolvedDepts.includes(partial.value)) resolvedDepts.push(partial.value);
            continue;
          }
          if (normInput.includes("plant 1") || normInput.includes("painting 1")) {
            const p1 = deptOptions.find((opt) => opt.value.toLowerCase().includes("plant 1"));
            if (p1 && !resolvedDepts.includes(p1.value)) resolvedDepts.push(p1.value);
          } else if (normInput.includes("plant 2") || normInput.includes("painting 2")) {
            const p2 = deptOptions.find((opt) => opt.value.toLowerCase().includes("plant 2"));
            if (p2 && !resolvedDepts.includes(p2.value)) resolvedDepts.push(p2.value);
          } else if (normInput.includes("paint")) {
            const p = deptOptions.find((opt) => opt.value.toLowerCase().includes("paint"));
            if (p && !resolvedDepts.includes(p.value)) resolvedDepts.push(p.value);
          } else {
            resolvedDepts.push(inputDept);
          }
        }
      }

      // Fallback Use by Dept jika belum terisi: ambil dari Plant di filename atau warehouse
      if (resolvedDepts.length === 0) {
        const fileNameUpper = file.name.toUpperCase();
        if (fileNameUpper.includes("PLANT 1")) {
          const p1 = deptOptions.find((opt) => opt.value.toLowerCase().includes("plant 1"));
          if (p1) resolvedDepts.push(p1.value);
        } else if (fileNameUpper.includes("PLANT 2")) {
          const p2 = deptOptions.find((opt) => opt.value.toLowerCase().includes("plant 2"));
          if (p2) resolvedDepts.push(p2.value);
        }
      }
      if (resolvedDepts.length > 0) {
        setSelectedDepts(resolvedDepts);
      }

      // 3. Usage for / Purpose Project
      if (data.purposeProject) {
        setPurposeProject(data.purposeProject);
      }

      // 4. Delivery / Finish (Schedule & Type)
      if (data.deliveryDateType) {
        setDeliveryDateType(data.deliveryDateType);
      }
      if (data.expectedDelivery) {
        setExpectedDelivery(data.expectedDelivery);
      }

      // 5. Notes (Quotation / Remarks)
      if (data.notes) {
        setNotes(data.notes);
      }

      // 6. Items auto-fill (Preserve exact matches, do NOT fallback to items[0], filter qty > 0)
      const validItems = (data.items || []).filter((it: any) => Number(it.qty) > 0);
      if (validItems.length > 0) {
        let matchedCount = 0;
        const newRows = validItems.map((it: any) => {
          const matchedDbItem = it.itemId ? items.find((item) => item.id === it.itemId) : null;
          if (matchedDbItem) matchedCount++;
          const pkgSize = matchedDbItem?.packageSize ? Number(matchedDbItem.packageSize) : null;
          const rawQty = Number(it.qty) || 1;
          const pkgQty = pkgSize && pkgSize > 0 ? Math.ceil(rawQty / pkgSize) : 1;
          const calculatedBaseQty = pkgSize && pkgSize > 0 ? pkgQty * pkgSize : rawQty;
          return {
            itemId: it.itemId || "",
            qty: calculatedBaseQty,
            packageQty: pkgQty,
            unitPrice: it.unitPrice > 0 ? it.unitPrice : (matchedDbItem?.lastUnitPrice ?? 0),
          };
        });
        setRows(newRows);

        const unmatchedCount = validItems.length - matchedCount;
        setSuccessMsg(
          `Berhasil mengekstrak ${validItems.length} item aktif dari file Excel ${file.name}${
            data.poNumber ? ` (No. PO: ${data.poNumber})` : ""
          }.${
            unmatchedCount > 0
              ? ` (${matchedCount} item otomatis cocok dengan database, ${unmatchedCount} item perlu verifikasi/pilihan manual).`
              : " Seluruh item berhasil dicocokkan otomatis!"
          }`
        );
      } else {
        setError("File Excel terbaca tetapi tidak ditemukan baris item dengan Qty > 0.");
      }
    } catch (err: any) {
      setError("Terjadi kesalahan saat memproses file Excel.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!supplierId) {
      setError("Supplier wajib dipilih");
      setSubmitting(false);
      return;
    }

    if (!warehouseId) {
      setError("Warehouse / Lokasi Tujuan wajib dipilih");
      setSubmitting(false);
      return;
    }

    if (!poDate) {
      setError("Tanggal PO wajib diisi");
      setSubmitting(false);
      return;
    }

    const details = rows
      .filter((r) => r.itemId && Number(r.qty) > 0)
      .map((r) => ({
        itemId: r.itemId,
        qty: Math.max(1, Number(r.qty) || 1),
        unitPrice: Math.max(0, Number(r.unitPrice) || 0),
      }));

    if (details.length === 0) {
      setError("Minimal satu item barang harus dipilih dan memiliki jumlah pemesanan");
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.set("poNumber", poNumber.trim());
    fd.set("poDate", poDate);
    fd.set("supplierId", supplierId);
    fd.set("warehouseId", warehouseId);
    fd.set("department", selectedDepts.join(", "));
    fd.set("purposeProject", purposeProject.trim());
    fd.set("expectedDelivery", expectedDelivery);
    fd.set("deliveryDateType", deliveryDateType);
    fd.set("notes", notes.trim());
    fd.set("details", JSON.stringify(details));

    const res = await createPo(fd);
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
    } else if (res?.redirect) {
      window.location.href = res.redirect;
    }
  }

  const itemOptions = items.map((it) => ({
    value: it.id,
    label: `${it.code} — ${it.name}${it.unit ? ` (${it.unit})` : ""}`,
  }));

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {/* ─── TOOLBAR CEPAT: Ekstrak Excel PO (Opsional) ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-3.5 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-800">Punya File Excel PO?</span>
            <span className="text-slate-500 ml-1.5 hidden sm:inline">
              Unggah file template untuk auto-fill seluruh isian form di bawah.
            </span>
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-po-deck-upload"
          />
          <label
            htmlFor="excel-po-deck-upload"
            className={`btn btn-light btn-sm text-xs gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 cursor-pointer ${
              extracting ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            {extracting ? "Mengekstrak..." : "Upload Excel Template"}
          </label>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success flex items-center gap-2 py-2.5 text-sm" role="alert">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger flex items-center gap-2 py-2.5 text-sm" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DECK LAYOUT: DOKUMEN PURCHASE ORDER (PERSIS TEMPLATE EXCEL RESMI)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-2 border-slate-900 rounded-xl shadow-lg p-5 sm:p-8 text-slate-900 text-xs font-sans space-y-4">
        
        {/* ─── 1. KOP SURAT RESMI PERUSAHAAN (Sesuai Template SRI) ─── */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 gap-2">
          {/* Logo Kiri */}
          <div className="shrink-0 w-24 sm:w-28 flex items-center justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sri-logo.png"
              alt="Logo Sakae Riken"
              className="w-20 sm:w-24 h-auto object-contain"
            />
          </div>

          {/* Teks Kop Tengah */}
          <div className="text-center space-y-0.5 px-2 flex-1">
            <h1 className="text-sm sm:text-base font-extrabold tracking-wider text-black uppercase">
              PT. SAKAE RIKEN INDONESIA
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-700 leading-tight">
              Kawasan Industri Suryacipta, Jl. Surya Kencana Kav. I-17 GH &amp; I-M2EF
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-700 leading-tight">
              Kutamekar, Ciampel, Karawang, Jawa Barat , Indonesia 41361
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-600 leading-tight">
              Phone: +62-267-8610349, Fax: +62-267-8610350
            </p>
          </div>

          {/* Logo Kanan: Sertifikasi ISO */}
          <div className="shrink-0 w-24 sm:w-28 flex items-center justify-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sri-iso.jpg"
              alt="Certified ISO/TS 16949"
              className="w-18 sm:w-22 h-auto object-contain"
            />
          </div>
        </div>

        {/* ─── 2. JUDUL DOKUMEN: PURCHASE ORDER ─── */}
        <div className="text-center py-1">
          <h2 className="text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase underline decoration-2 underline-offset-4">
            PURCHASE ORDER
          </h2>
        </div>

        {/* ─── 3. METADATA HEADER PO (VENDOR TO: & KOTAK PO NO:) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-2 text-xs">
          
          {/* Kolom Kiri (To: Supplier, Alamat, Phone, Attn, Date) */}
          <div className="md:col-span-8 space-y-2 border border-slate-300 rounded-lg p-3 bg-slate-50/50">
            {/* TO: Supplier */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="w-16 font-bold text-slate-900 shrink-0">To :</span>
              <div className="flex-1">
                <SearchableSelect
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Pilih Supplier..."
                  searchPlaceholder="Cari nama supplier..."
                />
              </div>
            </div>

            {/* Alamat Supplier */}
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-[11px] text-slate-600">
              <span className="w-16 font-semibold shrink-0">Alamat :</span>
              <span className="flex-1 italic">
                {selectedSupplier?.address || "— Pilih supplier untuk menampilkan alamat —"}
              </span>
            </div>

            {/* Phone & Attn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold shrink-0">Phone :</span>
                <span className="text-slate-800 font-medium">
                  {selectedSupplier?.phone || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold shrink-0">Attn :</span>
                <span className="text-slate-800 font-medium">
                  {selectedSupplier?.contactPerson || "—"}
                </span>
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pt-1 border-t border-slate-200">
              <span className="w-16 font-bold text-slate-900 shrink-0">Date :</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  name="poDate"
                  className={`form-control !py-1 !text-xs max-w-xs font-semibold ${
                    !poDate ? "border-amber-300 bg-amber-50/30" : ""
                  }`}
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  required
                />
                {!poDate && (
                  <span className="text-[10px] text-amber-600 font-medium">
                    * Belum diisi
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Kolom Kanan (Kotak PO NO: & Warehouse Tujuan) */}
          <div className="md:col-span-4 flex flex-col justify-between space-y-3">
            {/* Box Khas Excel Template untuk PO NO : */}
            <div className="border-2 border-slate-900 rounded-lg overflow-hidden text-center bg-white shadow-xs">
              <div className="border-b-2 border-slate-900 py-1 px-2 font-black uppercase tracking-wider text-xs bg-slate-100 text-slate-900">
                PO NO :
              </div>
              <div className="p-2">
                <input
                  type="text"
                  name="poNumber"
                  className="w-full text-center font-mono font-bold text-sm text-slate-900 border-none outline-none focus:ring-0 p-0 placeholder:font-mono placeholder:text-xs placeholder:text-slate-400 placeholder:font-medium"
                  placeholder={`(Auto: ${displaySuggestedPo})`}
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-[9px] text-slate-400">
                    {poNumber ? "Nomor manual diinput" : `Kosong = Otomatis (${displaySuggestedPo})`}
                  </span>
                  {!poNumber && (
                    <button
                      type="button"
                      onClick={() => setPoNumber(displaySuggestedPo)}
                      className="text-[9px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                    >
                      Gunakan No. Saran
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Warehouse Select */}
            <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Warehouse / Lokasi Tujuan :</span>
                {!warehouseId && (
                  <span className="text-amber-600 font-normal lowercase">* belum dipilih</span>
                )}
              </label>
              <SearchableSelect
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="Pilih Warehouse..."
                searchPlaceholder="Cari gudang..."
              />
            </div>
          </div>
        </div>

        {/* ─── 4. TABEL UTAMA ITEM (Persis Kolom di Template Excel SRI) ─── */}
        <div className="mt-4">
          <div className="overflow-x-auto rounded-lg border-2 border-slate-900">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 text-center font-bold">
                  <th className="border-r border-slate-900 p-2 w-10">NO</th>
                  <th className="border-r border-slate-900 p-2 text-left min-w-[220px]">
                    DESCRIPTIONS (NAMA BARANG)
                  </th>
                  <th className="border-r border-slate-900 p-2 min-w-[140px]">
                    PACKAGE (SPEK)
                  </th>
                  <th className="border-r border-slate-900 p-2 w-24 text-right">
                    QTY (Kemasan)
                  </th>
                  <th className="border-r border-slate-900 p-2 w-16 text-center">
                    SATUAN (Kemasan)
                  </th>
                  <th className="border-r border-slate-900 p-2 w-20 text-right">
                    QTY (Satuan Dasar)
                  </th>
                  <th className="border-r border-slate-900 p-2 w-14 text-center">
                    SATUAN (Dasar)
                  </th>
                  <th className="border-r border-slate-900 p-2 w-48 min-w-[170px] text-right">
                    UNIT PRICE (Rp)
                  </th>
                  <th className="border-r border-slate-900 p-2 w-36 text-right">
                    AMOUNT (Rp)
                  </th>
                  <th className="p-2 w-12 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const currentItem = items.find((it) => it.id === row.itemId);
                  const masterPrice = currentItem?.lastUnitPrice ?? 0;
                  const currentPrice = Number(row.unitPrice) || 0;
                  const isPriceDifferent = currentPrice > 0 && Math.abs(currentPrice - masterPrice) > 0.01;
                  const pkgSize = currentItem?.packageSize ? Number(currentItem.packageSize) : null;
                  const pkgUnit = currentItem?.packageUnit || "Pail";
                  const baseUnit = currentItem?.unit || "kg";
                  const hasPackaging = Boolean(pkgSize && pkgSize > 0);
                  const rowAmount = (Number(row.qty) || 0) * currentPrice;

                  // Format keterangan Package seperti di Excel (e.g. "1 Pail = 20 kg")
                  const packageSpec = hasPackaging && pkgUnit.toLowerCase() !== baseUnit.toLowerCase()
                    ? `1 ${pkgUnit} = ${pkgSize} ${baseUnit}`
                    : "—";

                  return (
                    <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50/70 transition-colors">
                      {/* NO */}
                      <td className="border-r border-slate-900 p-2 text-center font-bold text-slate-600 align-middle">
                        {idx + 1}
                      </td>

                      {/* DESCRIPTIONS (Nama Barang) */}
                      <td className="border-r border-slate-900 p-2 align-middle">
                        <SearchableSelect
                          options={itemOptions}
                          value={row.itemId}
                          onChange={(val) => updateRow(idx, "itemId", val)}
                          placeholder="Pilih item barang..."
                          searchPlaceholder="Ketik kode atau nama..."
                        />
                        {currentItem?.code && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Kode: {currentItem.code}
                          </div>
                        )}
                        {!row.itemId && (
                          <span className="text-[10px] text-amber-600 italic block mt-0.5">
                            * Item belum dipilih
                          </span>
                        )}
                      </td>

                      {/* PACKAGE (Spek Kemasan) */}
                      <td className="border-r border-slate-900 p-2 text-center align-middle font-mono text-[11px] text-slate-700 bg-slate-50/40">
                        {packageSpec}
                      </td>

                      {/* QTY (Kemasan - Misal Pail / Drum) */}
                      <td className="border-r border-slate-900 p-2 align-middle">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          disabled={!hasPackaging}
                          className={`w-full text-right font-bold text-slate-900 p-1 border rounded focus:border-blue-500 text-xs ${
                            !hasPackaging
                              ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                              : !row.packageQty
                              ? "border-amber-300 bg-amber-50/30"
                              : "border-slate-300"
                          }`}
                          placeholder={hasPackaging ? "Jml Kemasan" : "—"}
                          value={row.packageQty}
                          onChange={(e) => updateRow(idx, "packageQty", e.target.value)}
                        />
                        {hasPackaging && (
                          <span className="text-[9px] text-blue-600 block text-right mt-0.5 font-medium">
                            Satuan {pkgUnit}
                          </span>
                        )}
                      </td>

                      {/* UNIT (Kemasan) */}
                      <td className="border-r border-slate-900 p-2 text-center align-middle text-slate-700 font-semibold uppercase text-[11px] bg-slate-50/30">
                        {hasPackaging ? pkgUnit : "—"}
                      </td>

                      {/* QTY (Satuan Dasar - DIKUNCI / LOCKED jika ada kemasan pail) */}
                      <td className="border-r border-slate-900 p-2 align-middle">
                        <div className="relative">
                          <input
                            name={`qty_${idx}`}
                            type="number"
                            min={1}
                            readOnly={hasPackaging}
                            className={`w-full text-right font-bold p-1 border rounded text-xs transition ${
                              hasPackaging
                                ? "bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed select-none"
                                : !row.qty
                                ? "border-amber-300 bg-amber-50/30 text-slate-900 focus:border-blue-500"
                                : "bg-white text-slate-900 border-slate-300 focus:border-blue-500"
                            }`}
                            placeholder={hasPackaging ? "Otomatis" : "Qty"}
                            value={row.qty}
                            onChange={(e) => updateRow(idx, "qty", e.target.value)}
                            required
                          />
                        </div>
                        {hasPackaging ? (
                          <div
                            className="flex items-center justify-end gap-0.5 text-[9px] text-emerald-700 font-semibold mt-0.5"
                            title={`Kunci: ${row.packageQty || 0} × ${pkgSize} ${baseUnit}`}
                          >
                            <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span className="truncate">({row.packageQty || 0}×{pkgSize})</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 block text-right mt-0.5 truncate">
                            Langsung
                          </span>
                        )}
                      </td>

                      {/* UNIT (Satuan Dasar) */}
                      <td className="border-r border-slate-900 p-2 text-center align-middle text-slate-700 font-semibold uppercase text-[11px] bg-slate-50/30">
                        {baseUnit}
                      </td>

                      {/* UNIT PRICE (Harga Satuan - Format titik pemisah ribuan, disimpan angka mentah) */}
                      <td className="border-r border-slate-900 p-2 align-middle">
                        <input
                          name={`unitPrice_${idx}`}
                          type="text"
                          inputMode="numeric"
                          className={`w-full text-right font-bold p-1 border rounded text-xs transition focus:outline-none ${
                            isPriceDifferent
                              ? "border-amber-400 bg-amber-50/50 text-amber-900 font-extrabold focus:border-amber-500"
                              : "border-slate-300 text-slate-900 focus:border-blue-500"
                          }`}
                          placeholder="0"
                          value={
                            row.unitPrice === "" || row.unitPrice === undefined || row.unitPrice === null
                              ? ""
                              : Number(row.unitPrice).toLocaleString("id-ID")
                          }
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            updateRow(idx, "unitPrice", digits === "" ? "" : Number(digits));
                          }}
                        />
                        {isPriceDifferent ? (
                          <span className="text-[9px] text-amber-700 font-bold block text-right mt-0.5 whitespace-nowrap">
                            ⚡ Update Master ({masterPrice > 0 ? "semula: " + masterPrice.toLocaleString("id-ID") : "kosong"})
                          </span>
                        ) : masterPrice > 0 ? (
                          <span className="text-[9px] text-slate-400 block text-right mt-0.5">
                            Harga master
                          </span>
                        ) : null}
                      </td>

                      {/* AMOUNT (Harga Total) */}
                      <td className="border-r border-slate-900 p-2 text-right align-middle font-bold text-slate-900 whitespace-nowrap">
                        {rowAmount.toLocaleString("id-ID")}
                      </td>

                      {/* AKSI */}
                      <td className="p-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-20 cursor-pointer"
                          disabled={rows.length === 1}
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ─── FOOTER TABEL: NOTES KIRI & TOTAL KANAN (Persis Template Excel) ─── */}
              <tfoot>
                {/* Baris Tombol Tambah Item */}
                <tr className="border-t border-slate-300 bg-slate-50/60">
                  <td colSpan={10} className="p-2">
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600" /> Tambah Baris Item (Excel Row)
                    </button>
                  </td>
                </tr>

                {/* Subtotal, VAT, Grand Total */}
                <tr className="border-t-2 border-slate-900">
                  {/* Kolom Kiri: Notes Dept & Usage for (Sesuai Baris 41-43 di Excel) */}
                  <td colSpan={5} rowSpan={3} className="border-r-2 border-slate-900 p-3 align-top bg-slate-50/50 space-y-2">
                    <div className="space-y-2 text-slate-800">
                      {/* Departemen (Multi-Select Tom-Select Style dari Tabel Dept) */}
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                        <span className="font-bold w-36 shrink-0 mt-1">Notes : Use by Dept. :</span>
                        <div className="flex-1 max-w-md">
                          <MultiSelect
                            options={deptOptions}
                            values={selectedDepts}
                            onChange={setSelectedDepts}
                            placeholder="Pilih departemen..."
                            searchPlaceholder="Ketik nama departemen..."
                            name="department"
                          />
                          <span className="text-[10px] text-slate-500 mt-0.5 block">
                            Dapat memilih lebih dari satu departemen (Multi-Select)
                          </span>
                        </div>
                      </div>

                      {/* Usage for */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                        <span className="font-bold w-36 shrink-0">Notes : Usage for :</span>
                        <input
                          type="text"
                          name="purposeProject"
                          className="form-control !py-0.5 !text-xs max-w-md font-medium"
                          placeholder="Misal: Additional Order / Painting Equipment"
                          value={purposeProject}
                          onChange={(e) => setPurposeProject(e.target.value)}
                        />
                      </div>

                      {/* Delivery / Finish */}
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                        <span className="font-bold w-36 shrink-0 mt-1">Delivery / Finish :</span>
                        <div className="space-y-1.5 flex-1 max-w-md">
                          {/* Toggle Mode: Tanggal Pasti vs Periode Bulan */}
                          <div className="flex items-center gap-3 text-xs">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="deliveryTypeRadio"
                                checked={deliveryDateType === "DATE"}
                                onChange={() => {
                                  setDeliveryDateType("DATE");
                                  setExpectedDelivery("");
                                }}
                                className="text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span className="font-medium text-slate-700">Tanggal Pasti</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="deliveryTypeRadio"
                                checked={deliveryDateType === "MONTH"}
                                onChange={() => {
                                  setDeliveryDateType("MONTH");
                                  setExpectedDelivery("");
                                }}
                                className="text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span className="font-medium text-slate-700">Periode Bulan</span>
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            {deliveryDateType === "DATE" ? (
                              <input
                                type="date"
                                name="expectedDelivery"
                                className="form-control !py-0.5 !text-xs max-w-xs"
                                value={expectedDelivery}
                                onChange={(e) => setExpectedDelivery(e.target.value)}
                              />
                            ) : (
                              <input
                                type="month"
                                name="expectedDelivery"
                                className="form-control !py-0.5 !text-xs max-w-xs"
                                value={expectedDelivery}
                                onChange={(e) => setExpectedDelivery(e.target.value)}
                              />
                            )}
                            <span className="text-[10px] text-slate-400">
                              {deliveryDateType === "DATE" ? "Cth: 25/09/2026" : "Cth: September 2026"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quotation / Remarks */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                        <span className="font-bold w-36 shrink-0">Quotation / Remarks :</span>
                        <input
                          type="text"
                          name="notes"
                          className="form-control !py-0.5 !text-xs max-w-md"
                          placeholder="No. Quotation supplier atau instruksi tambahan..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </td>

                  {/* SUB TOTAL */}
                  <td colSpan={2} className="border-r border-slate-900 p-2 text-right font-bold uppercase tracking-wider bg-slate-100">
                    SUB TOTAL
                  </td>
                  <td colSpan={3} className="p-2 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                    Rp {subtotal.toLocaleString("id-ID")}
                  </td>
                </tr>

                {/* VAT (11%) */}
                <tr className="border-t border-slate-900">
                  <td colSpan={2} className="border-r border-slate-900 p-2 text-right font-bold uppercase tracking-wider bg-slate-100">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeVat}
                        onChange={(e) => setIncludeVat(e.target.checked)}
                        className="rounded border-slate-400 text-blue-600 focus:ring-0"
                      />
                      <span>VAT (11%)</span>
                    </label>
                  </td>
                  <td colSpan={3} className="p-2 text-right font-semibold text-slate-800 text-xs whitespace-nowrap">
                    Rp {vatAmount.toLocaleString("id-ID")}
                  </td>
                </tr>

                {/* GRAND TOTAL */}
                <tr className="border-t-2 border-slate-900 bg-slate-100/80">
                  <td colSpan={2} className="border-r border-slate-900 p-2 text-right font-black uppercase tracking-wider text-xs">
                    TOTAL
                  </td>
                  <td colSpan={3} className="p-2 text-right font-black text-slate-950 text-base whitespace-nowrap">
                    Rp {grandTotal.toLocaleString("id-ID")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ─── 5. KOTAK TERBILANG (Persis Seperti di Template Excel SRI) ─── */}
        <div className="border border-slate-900 bg-slate-50/70 p-2.5 rounded-lg flex items-center gap-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-slate-700 shrink-0">
            Terbilang :
          </span>
          <span className="font-bold italic text-slate-900 capitalize flex-1">
            # {terbilangText} #
          </span>
        </div>

        {/* Notifikasi Indikator Perubahan Harga Master */}
        {priceChangedCount > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Terdapat <strong>{priceChangedCount} item</strong> dengan harga satuan baru. Saat PO disimpan, harga tersebut akan otomatis disimpan sebagai harga terkini pada tabel master item dan tercatat di riwayat harga.
            </span>
          </div>
        )}
      </div>

      {/* ─── ACTION BAR BAWAH ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <Link
          href="/purchasing/purchase-orders"
          className="btn btn-light text-xs gap-1.5 w-full sm:w-auto justify-center"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Batal / Kembali ke Daftar PO
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary text-xs px-6 py-2.5 w-full sm:w-auto font-bold shadow-md cursor-pointer"
        >
          {submitting ? "Menyimpan PO & Update Master Item..." : "Simpan Purchase Order (PO)"}
        </button>
      </div>
    </form>
  );
}
