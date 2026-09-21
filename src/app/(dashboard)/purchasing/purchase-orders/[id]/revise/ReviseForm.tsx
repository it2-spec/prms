"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Building2,
  Warehouse as WarehouseIcon,
  ShieldAlert,
  Loader2,
  Check,
  FileText,
  Lock,
  GitCommit,
  Tag,
  Clock,
  User,
  History,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import MultiSelect from "@/components/MultiSelect";
import { Button, Badge } from "@/components/ui";

export type ItemOption = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  packageUnit?: string | null;
  packageSize?: number | null;
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
  code?: string;
  name: string;
};

export type DetailRow = {
  id?: string;
  itemId: string;
  qty: number | "";
  packageQty?: number | "";
  unitPrice: number | "";
  receivedQty?: number;
};

export type RevisionLogItem = {
  id: string;
  createdAt: string;
  userName: string;
  action: string;
  detail: string | null;
};

interface ReviseFormProps {
  poId: string;
  poNumber: string;
  poDate: string;
  revisionCount: number;
  supplier: SupplierOption;
  initialWarehouseId: string;
  initialExpectedDelivery: string;
  initialDeliveryDateType: "DATE" | "MONTH";
  initialDepartment: string;
  initialPurposeProject: string;
  initialNotes: string;
  deptOptions: DeptOption[];
  warehouses: WarehouseOption[];
  items: ItemOption[];
  initialDetails: DetailRow[];
  previousRevisions?: RevisionLogItem[];
  revisePo: (poId: string, formData: FormData) => Promise<{ error?: string; redirect?: string }>;
}

function angkaTerbilang(nilai: number): string {
  const bilangan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima",
    "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas",
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

export default function ReviseForm({
  poId,
  poNumber,
  poDate,
  revisionCount,
  supplier,
  initialWarehouseId,
  initialExpectedDelivery,
  initialDeliveryDateType,
  initialDepartment,
  initialPurposeProject,
  initialNotes,
  deptOptions,
  warehouses,
  items,
  initialDetails,
  previousRevisions = [],
  revisePo,
}: ReviseFormProps) {
  const nextRevTag = `REV ${String(revisionCount + 1).padStart(2, "0")}`;

  const [warehouseId, setWarehouseId] = useState(initialWarehouseId);
  const [expectedDelivery, setExpectedDelivery] = useState(initialExpectedDelivery);
  const [deliveryDateType, setDeliveryDateType] = useState<"DATE" | "MONTH">(initialDeliveryDateType);
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    initialDepartment ? initialDepartment.split(",").map((s) => s.trim()).filter(Boolean) : []
  );
  const [purposeProject, setPurposeProject] = useState(initialPurposeProject || "");
  const [notes, setNotes] = useState(initialNotes || "");
  const [includeVat, setIncludeVat] = useState(true);
  const [revisionReason, setRevisionReason] = useState("");

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Inisialisasi baris item dengan konversi packageQty
  const [rows, setRows] = useState<DetailRow[]>(() => {
    return initialDetails.map((d) => {
      const it = itemMap.get(d.itemId);
      const pkgSize = it?.packageSize ? Number(it.packageSize) : null;
      const numQty = Number(d.qty) || 0;
      const packageQty = pkgSize && pkgSize > 0 ? Math.floor(numQty / pkgSize) : numQty;
      return {
        ...d,
        packageQty,
      };
    });
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Perhitungan Subtotal, PPN, dan Grand Total
  const subtotal = rows.reduce(
    (s, r) => s + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0),
    0
  );
  const vatAmount = includeVat ? Math.round(subtotal * 0.11) : 0;
  const grandTotal = subtotal + vatAmount;
  const terbilangText = formatTerbilang(grandTotal);

  // ─── LIVE REVISION DETECTOR: Deteksi perubahan secara otomatis ───
  const changesDetector = useMemo(() => {
    const initialMap = new Map(initialDetails.map((d) => [d.itemId, d]));
    const currentItemIds = new Set(rows.map((r) => r.itemId).filter(Boolean));

    const itemsAdded: string[] = [];
    const itemsRemoved: string[] = [];
    const qtyChanges: string[] = [];
    const priceChanges: string[] = [];
    const otherChanges: string[] = [];

    // Deteksi item baru dan perubahan qty/harga
    for (const r of rows) {
      if (!r.itemId) continue;
      const it = itemMap.get(r.itemId);
      const itemName = it ? `${it.name} (${it.code})` : r.itemId;
      const unit = it?.unit || "kg";

      const oldD = initialMap.get(r.itemId);
      if (!oldD) {
        itemsAdded.push(`${itemName} — Qty: ${r.qty} ${unit}`);
      } else {
        const oldQty = Number(oldD.qty) || 0;
        const newQty = Number(r.qty) || 0;
        if (oldQty !== newQty) {
          const diff = newQty - oldQty;
          qtyChanges.push(
            `${itemName}: Qty diubah dari ${oldQty} ${unit} ➔ ${newQty} ${unit} (${diff > 0 ? "+" : ""}${diff} ${unit})`
          );
        }

        const oldPrice = Number(oldD.unitPrice) || 0;
        const newPrice = Number(r.unitPrice) || 0;
        if (Math.abs(oldPrice - newPrice) > 0.01) {
          priceChanges.push(
            `${itemName}: Harga satuan diubah dari Rp ${oldPrice.toLocaleString("id-ID")} ➔ Rp ${newPrice.toLocaleString("id-ID")}`
          );
        }
      }
    }

    // Deteksi item yang dihapus
    for (const oldD of initialDetails) {
      if (!currentItemIds.has(oldD.itemId)) {
        const it = itemMap.get(oldD.itemId);
        const itemName = it ? `${it.name} (${it.code})` : oldD.itemId;
        itemsRemoved.push(`${itemName} (semula ${oldD.qty} ${it?.unit || "kg"})`);
      }
    }

    // Deteksi perubahan metadata
    if (warehouseId !== initialWarehouseId) {
      const oldW = warehouses.find((w) => w.id === initialWarehouseId)?.name || initialWarehouseId;
      const newW = warehouses.find((w) => w.id === warehouseId)?.name || warehouseId;
      otherChanges.push(`Gudang Tujuan: ${oldW} ➔ ${newW}`);
    }

    if (expectedDelivery !== initialExpectedDelivery) {
      otherChanges.push(
        `Estimasi Kirim: ${initialExpectedDelivery || "Kosong"} ➔ ${expectedDelivery || "Kosong"}`
      );
    }

    const currentDeptStr = selectedDepts.join(", ");
    if (currentDeptStr !== initialDepartment) {
      otherChanges.push(`Departemen: ${initialDepartment || "Kosong"} ➔ ${currentDeptStr || "Kosong"}`);
    }

    if (purposeProject.trim() !== initialPurposeProject.trim()) {
      otherChanges.push(`Project/Purpose: "${initialPurposeProject}" ➔ "${purposeProject}"`);
    }

    const hasAnyChange =
      itemsAdded.length > 0 ||
      itemsRemoved.length > 0 ||
      qtyChanges.length > 0 ||
      priceChanges.length > 0 ||
      otherChanges.length > 0;

    return {
      itemsAdded,
      itemsRemoved,
      qtyChanges,
      priceChanges,
      otherChanges,
      hasAnyChange,
    };
  }, [
    rows,
    initialDetails,
    itemMap,
    warehouseId,
    initialWarehouseId,
    expectedDelivery,
    initialExpectedDelivery,
    selectedDepts,
    initialDepartment,
    purposeProject,
    initialPurposeProject,
    warehouses,
  ]);

  function addRow() {
    const available = items.find((it) => !rows.some((r) => r.itemId === it.id)) || items[0];
    const pkgSize = available?.packageSize ? Number(available.packageSize) : null;
    const hasPkg = Boolean(pkgSize && pkgSize > 0);

    setRows((prev) => [
      ...prev,
      {
        itemId: available?.id ?? "",
        qty: hasPkg ? pkgSize! : 1,
        packageQty: hasPkg ? 1 : "",
        unitPrice: available?.lastUnitPrice ?? 0,
        receivedQty: 0,
      },
    ]);
  }

  function updateRow(i: number, key: keyof DetailRow, val: any) {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== i) return row;

        const currentItem = itemMap.get(key === "itemId" ? val : row.itemId);
        const pkgSize = currentItem?.packageSize ? Number(currentItem.packageSize) : null;
        const hasPackaging = Boolean(pkgSize && pkgSize > 0);

        if (key === "itemId") {
          const matched = itemMap.get(val);
          const mPkgSize = matched?.packageSize ? Number(matched.packageSize) : null;
          const mHasPkg = Boolean(mPkgSize && mPkgSize > 0);
          return {
            ...row,
            itemId: String(val),
            unitPrice: matched?.lastUnitPrice ?? 0,
            packageQty: mHasPkg ? 1 : "",
            qty: mHasPkg ? mPkgSize! : 1,
          };
        }

        if (key === "packageQty") {
          if (val === "") {
            return { ...row, packageQty: "", qty: "" };
          }
          const pkgQ = Math.max(0, Number(val) || 0);
          const calculatedBaseQty = hasPackaging ? Math.round(pkgQ * (pkgSize || 1)) : pkgQ;
          return {
            ...row,
            packageQty: pkgQ,
            qty: calculatedBaseQty,
          };
        }

        if (key === "qty") {
          if (hasPackaging) return row; // Kunci qty jika item memiliki kemasan spek
          if (val === "") {
            return { ...row, qty: "", packageQty: "" };
          }
          const baseQ = Math.max(0, Number(val) || 0);
          return {
            ...row,
            qty: baseQ,
            packageQty: baseQ,
          };
        }

        if (key === "unitPrice") {
          return {
            ...row,
            unitPrice: val === "" ? "" : Math.max(0, Number(val) || 0),
          };
        }

        return { ...row, [key]: val };
      })
    );
  }

  function removeRow(i: number) {
    if (rows.length <= 1) {
      alert("Minimal satu item barang harus ada dalam Purchase Order.");
      return;
    }
    const target = rows[i];
    if (target.receivedQty && target.receivedQty > 0) {
      alert(`Item ini sudah pernah diterima fisik sebagian (${target.receivedQty}) dan tidak dapat dihapus dari PO.`);
      return;
    }
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!revisionReason.trim()) {
      setError("Alasan revisi wajib diisi! Mohon jelaskan mengapa Purchase Order ini direvisi.");
      return;
    }

    const validDetails = rows
      .filter((r) => r.itemId && Number(r.qty) > 0)
      .map((r) => ({
        id: r.id,
        itemId: r.itemId,
        qty: Math.max(1, Number(r.qty) || 1),
        unitPrice: Math.max(0, Number(r.unitPrice) || 0),
        receivedQty: r.receivedQty || 0,
      }));

    if (validDetails.length === 0) {
      setError("Minimal satu item barang harus dipilih dan memiliki kuantitas pemesanan.");
      return;
    }

    // Validasi kuantitas terhadap barang yang sudah diterima
    for (const r of validDetails) {
      const oldD = initialDetails.find((x) => x.itemId === r.itemId || x.id === r.id);
      const originalQty = oldD ? Number(oldD.qty) : 0;
      // Hanya tolak jika user sengaja MENURUNKAN kuantitas di bawah yang sudah diterima gudang
      if (r.receivedQty && r.qty < r.receivedQty && r.qty < originalQty) {
        const it = itemMap.get(r.itemId);
        setError(
          `Kuantitas item "${it?.name ?? r.itemId}" tidak boleh diturunkan kurang dari jumlah yang sudah diterima gudang (${r.receivedQty}).`
        );
        return;
      }
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.set("warehouseId", warehouseId);
    fd.set("expectedDelivery", expectedDelivery);
    fd.set("deliveryDateType", deliveryDateType);
    fd.set("department", selectedDepts.join(", "));
    fd.set("purposeProject", purposeProject.trim());
    fd.set("notes", notes.trim());
    fd.set("revisionReason", revisionReason.trim());
    fd.set("details", JSON.stringify(validDetails));

    try {
      const res = await revisePo(poId, fd);
      if (res?.error) {
        setError(res.error);
        setSubmitting(false);
      } else if (res?.redirect) {
        window.location.href = res.redirect;
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memproses revisi PO");
      setSubmitting(false);
    }
  }

  const itemOptions = items.map((it) => ({
    value: it.id,
    label: `${it.code} — ${it.name}${it.unit ? ` (${it.unit})` : ""}`,
  }));

  const formattedPoDate = poDate
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(poDate))
    : "-";

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {/* ─── ALERT ALUR REVISI & RESET APPROVAL ─── */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 shadow-sm flex items-start gap-3.5">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-950 text-sm">
              Perhatian: Form Revisi Dokumen PO (Revisi ke-{revisionCount + 1})
            </span>
            <span className="px-2 py-0.5 bg-amber-500 text-white font-mono font-bold text-[11px] rounded-md shadow-2xs">
              {nextRevTag}
            </span>
          </div>
          <p className="leading-relaxed text-amber-800">
            Menyimpan formulir ini akan mempublikasikan nomor dokumen revisi{" "}
            <strong>{poNumber} {nextRevTag}</strong> dan secara otomatis{" "}
            <strong>me-reset persetujuan tanda tangan digital (L1 Manager &amp; L2 Presdir)</strong>{" "}
            agar perubahan item, qty, atau harga diverifikasi kembali secara berjenjang.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center gap-2.5 py-3 text-xs font-semibold" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DECK LAYOUT FORMAL: FORMAT TEMPLATE RESMI PT. SAKAE RIKEN INDONESIA
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-xl p-5 sm:p-8 text-slate-900 text-xs font-sans space-y-4">
        
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
              Kutamekar, Ciampel, Karawang, Jawa Barat, Indonesia 41361
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

        {/* ─── 2. JUDUL DOKUMEN: PURCHASE ORDER (REVISION DECK) ─── */}
        <div className="text-center py-1">
          <h2 className="text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase underline decoration-2 underline-offset-4">
            PURCHASE ORDER
          </h2>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Formulir Revisi Dokumen — {nextRevTag}
            </span>
          </div>
        </div>

        {/* ─── 3. METADATA HEADER PO (VENDOR TO: & KOTAK PO NO DENGAN REV 01) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-2 text-xs">
          
          {/* Kolom Kiri: To Supplier Info (Read-Only) */}
          <div className="md:col-span-8 space-y-2 border border-slate-300 rounded-xl p-3.5 bg-slate-50/60">
            {/* TO: Supplier */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="w-16 font-bold text-slate-900 shrink-0">To :</span>
              <div className="flex-1 flex items-center gap-2 font-bold text-slate-900 text-xs">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{supplier.name}</span>
                {supplier.code && (
                  <span className="text-[11px] font-mono text-slate-500 font-normal">
                    ({supplier.code})
                  </span>
                )}
              </div>
            </div>

            {/* Alamat Supplier */}
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-[11px] text-slate-600">
              <span className="w-16 font-semibold shrink-0">Alamat :</span>
              <span className="flex-1 italic">
                {supplier.address || "— Alamat supplier tidak tersedia —"}
              </span>
            </div>

            {/* Phone & Attn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold shrink-0">Phone :</span>
                <span className="text-slate-800 font-medium">
                  {supplier.phone || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold shrink-0">Attn :</span>
                <span className="text-slate-800 font-medium">
                  {supplier.contactPerson || "—"}
                </span>
              </div>
            </div>

            {/* Tanggal Terbit PO Asli */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pt-1 border-t border-slate-200 text-[11px]">
              <span className="w-16 font-bold text-slate-900 shrink-0">Date :</span>
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{formattedPoDate}</span>
                <span className="text-[10px] text-slate-400 font-normal italic">
                  (Tanggal terbit awal PO)
                </span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Kotak PO NO dengan REV 01 + Warehouse Tujuan */}
          <div className="md:col-span-4 flex flex-col justify-between space-y-3">
            {/* Box Khas Excel SRI untuk PO NO : dengan REV 01 */}
            <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-center bg-white shadow-xs">
              <div className="border-b-2 border-slate-900 py-1 px-3 font-black uppercase tracking-wider text-xs bg-slate-100 text-slate-900 flex items-center justify-between">
                <span>PO NO :</span>
                <span className="px-2 py-0.5 bg-amber-500 text-white font-mono font-extrabold text-[10px] rounded tracking-normal">
                  {nextRevTag}
                </span>
              </div>
              <div className="p-2.5 bg-amber-50/20">
                <div className="font-mono font-black text-sm text-slate-900 tracking-wide flex items-center justify-center gap-1.5 flex-wrap">
                  <span>{poNumber}</span>
                  <span className="text-amber-600 font-extrabold">{nextRevTag}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-center gap-1">
                  <span>Nomor Dokumen Revisi Ke-{revisionCount + 1}</span>
                </div>
              </div>
            </div>

            {/* Warehouse / Lokasi Tujuan */}
            <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/60 space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <WarehouseIcon className="w-3 h-3 text-slate-500" />
                  Warehouse / Lokasi Tujuan :
                </span>
              </label>
              <SearchableSelect
                options={warehouses.map((w) => ({
                  value: w.id,
                  label: w.code ? `${w.code} — ${w.name}` : w.name,
                }))}
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
          <div className="overflow-x-auto rounded-xl border-2 border-slate-900">
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
                  const currentItem = itemMap.get(row.itemId);
                  const masterPrice = currentItem?.lastUnitPrice ?? 0;
                  const currentPrice = Number(row.unitPrice) || 0;
                  const isPriceDifferent = currentPrice > 0 && Math.abs(currentPrice - masterPrice) > 0.01;
                  const pkgSize = currentItem?.packageSize ? Number(currentItem.packageSize) : null;
                  const pkgUnit = currentItem?.packageUnit || "Pail";
                  const baseUnit = currentItem?.unit || "kg";
                  const hasPackaging = Boolean(pkgSize && pkgSize > 0);
                  const rowAmount = (Number(row.qty) || 0) * currentPrice;
                  const hasReceived = Boolean(row.receivedQty && row.receivedQty > 0);

                  const packageSpec =
                    hasPackaging && pkgUnit.toLowerCase() !== baseUnit.toLowerCase()
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
                          searchPlaceholder="Ketik kode atau nama item..."
                        />
                        {currentItem?.code && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center justify-between">
                            <span>Kode: {currentItem.code}</span>
                            {hasReceived && (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold text-[9px]">
                                Sudah diterima: {row.receivedQty} {baseUnit}
                              </span>
                            )}
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

                      {/* QTY (Kemasan - Pail / Can / Drum) */}
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

                      {/* QTY (Satuan Dasar) */}
                      <td className="border-r border-slate-900 p-2 align-middle">
                        <div className="relative">
                          <input
                            name={`qty_${idx}`}
                            type="number"
                            min={Math.min(Number(row.qty) || 1, row.receivedQty || 1)}
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
                        {hasReceived && (
                          <span
                            className={`text-[9px] block text-right font-medium truncate ${
                              (row.receivedQty || 0) > (Number(row.qty) || 0)
                                ? "text-amber-600 font-semibold"
                                : "text-slate-500"
                            }`}
                            title={`Sudah diterima fisik di gudang: ${row.receivedQty} ${baseUnit}`}
                          >
                            {(row.receivedQty || 0) > (Number(row.qty) || 0)
                              ? `Diterima: ${row.receivedQty} (+${(row.receivedQty || 0) - (Number(row.qty) || 0)})`
                              : `Diterima: ${row.receivedQty}`}
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
                            ⚡ Diubah ({masterPrice > 0 ? "semula: " + masterPrice.toLocaleString("id-ID") : "kosong"})
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
                          disabled={rows.length === 1 || Boolean(hasReceived)}
                          title={hasReceived ? "Item sudah ada receiving fisik dan tidak boleh dihapus" : "Hapus baris"}
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
                  <td colSpan={10} className="p-2.5">
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
                  {/* Kolom Kiri: Notes Dept, Usage for, Delivery Date, Remarks */}
                  <td colSpan={5} rowSpan={3} className="border-r-2 border-slate-900 p-3.5 align-top bg-slate-50/50 space-y-2">
                    <div className="space-y-2.5 text-slate-800">
                      {/* Departemen */}
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                        <span className="font-bold w-36 shrink-0 mt-1">Notes : Use by Dept. :</span>
                        <div className="flex-1 max-w-md">
                          <MultiSelect
                            options={deptOptions.map((d) => ({ value: d.name, label: d.name }))}
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
                          className="form-control !py-1 !text-xs max-w-md font-medium"
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
                                className="form-control !py-1 !text-xs max-w-xs"
                                value={expectedDelivery}
                                onChange={(e) => setExpectedDelivery(e.target.value)}
                              />
                            ) : (
                              <input
                                type="month"
                                name="expectedDelivery"
                                className="form-control !py-1 !text-xs max-w-xs"
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
                          className="form-control !py-1 !text-xs max-w-md"
                          placeholder="No. Quotation supplier atau instruksi tambahan..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </td>

                  {/* SUB TOTAL */}
                  <td colSpan={2} className="border-r border-slate-900 p-2.5 text-right font-bold uppercase tracking-wider bg-slate-100">
                    SUB TOTAL
                  </td>
                  <td colSpan={3} className="p-2.5 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                    Rp {subtotal.toLocaleString("id-ID")}
                  </td>
                </tr>

                {/* VAT (11%) */}
                <tr className="border-t border-slate-900">
                  <td colSpan={2} className="border-r border-slate-900 p-2.5 text-right font-bold uppercase tracking-wider bg-slate-100">
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
                  <td colSpan={3} className="p-2.5 text-right font-semibold text-slate-800 text-xs whitespace-nowrap">
                    Rp {vatAmount.toLocaleString("id-ID")}
                  </td>
                </tr>

                {/* GRAND TOTAL */}
                <tr className="border-t-2 border-slate-900 bg-slate-100/80">
                  <td colSpan={2} className="border-r border-slate-900 p-2.5 text-right font-black uppercase tracking-wider text-xs">
                    TOTAL
                  </td>
                  <td colSpan={3} className="p-2.5 text-right font-black text-slate-950 text-base whitespace-nowrap">
                    Rp {grandTotal.toLocaleString("id-ID")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ─── 5. KOTAK TERBILANG ─── */}
        <div className="border border-slate-900 bg-slate-50/70 p-2.5 rounded-xl flex items-center gap-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-slate-700 shrink-0">
            Terbilang :
          </span>
          <span className="font-bold italic text-slate-900 capitalize flex-1">
            # {terbilangText} #
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          6. SECTION WAJIB: ALASAN & LOG PERUBAHAN REVISI PO
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-indigo-600" />
            Catatan Log Revisi PO ({nextRevTag})
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Wajib diisi sebagai pertanggungjawaban audit
          </span>
        </div>

        {/* Input Alasan Mengapa Direvisi */}
        <div className="space-y-1.5">
          <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
            <span>Alasan Revisi PO (Mengapa Direvisi?) <span className="text-rose-500">*</span></span>
            <span className="text-[11px] text-slate-400 font-normal">Wajib diisi</span>
          </label>
          <textarea
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Contoh: Revisi kuantitas thinner & penambahan item hardener atas permintaan user painting plant 1, penyesuaian jadwal kirim ke akhir bulan..."
            required
          />
        </div>

        {/* LIVE DIFF DETECTOR: Ringkasan Perubahan Terdeteksi */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Deteksi Perubahan Otomatis:
            </span>
            <span className="text-[10px] text-slate-500">
              {changesDetector.hasAnyChange ? "Ada modifikasi data" : "Belum ada modifikasi"}
            </span>
          </div>

          {!changesDetector.hasAnyChange ? (
            <p className="text-xs text-slate-400 italic">
              Belum ada perubahan item, kuantitas, harga, maupun metadata PO yang dilakukan.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {/* Revisi Item (Tambah/Hapus) */}
              {(changesDetector.itemsAdded.length > 0 || changesDetector.itemsRemoved.length > 0) && (
                <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/80 space-y-1">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[10px]">Revisi Item</span>
                    <span>Perubahan Daftar Barang:</span>
                  </div>
                  <ul className="list-disc list-inside text-blue-800 text-[11px] space-y-0.5 ml-1">
                    {changesDetector.itemsAdded.map((it, i) => (
                      <li key={`add-${i}`} className="text-emerald-700 font-medium">
                        <strong>[Item Baru Ditambah]</strong>: {it}
                      </li>
                    ))}
                    {changesDetector.itemsRemoved.map((it, i) => (
                      <li key={`rem-${i}`} className="text-rose-700 font-medium">
                        <strong>[Item Dihapus]</strong>: {it}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Revisi Qty */}
              {changesDetector.qtyChanges.length > 0 && (
                <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[10px]">Revisi Qty</span>
                    <span>Perubahan Kuantitas Pesanan:</span>
                  </div>
                  <ul className="list-disc list-inside text-emerald-800 text-[11px] space-y-0.5 ml-1">
                    {changesDetector.qtyChanges.map((q, i) => (
                      <li key={`qty-${i}`}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Revisi Harga */}
              {changesDetector.priceChanges.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded text-[10px]">Revisi Harga</span>
                    <span>Perubahan Harga Satuan:</span>
                  </div>
                  <ul className="list-disc list-inside text-amber-800 text-[11px] space-y-0.5 ml-1">
                    {changesDetector.priceChanges.map((p, i) => (
                      <li key={`price-${i}`}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Revisi Metadata */}
              {changesDetector.otherChanges.length > 0 && (
                <div className="p-2.5 rounded-lg bg-purple-50/80 border border-purple-200/80 space-y-1">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded text-[10px]">Revisi Data PO</span>
                    <span>Perubahan Informasi Umum:</span>
                  </div>
                  <ul className="list-disc list-inside text-purple-800 text-[11px] space-y-0.5 ml-1">
                    {changesDetector.otherChanges.map((o, i) => (
                      <li key={`other-${i}`}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── 7. RIWAYAT REVISI SEBELUMNYA (JIKA ADA) ─── */}
      {previousRevisions.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-500" />
            Riwayat Revisi Sebelumnya ({previousRevisions.length} kali direvisi)
          </h4>
          <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden text-xs">
            {previousRevisions.map((rev, idx) => {
              let parsed: any = null;
              try {
                parsed = JSON.parse(rev.detail || "{}");
              } catch {
                parsed = { reason: rev.detail };
              }

              return (
                <div key={rev.id || idx} className="p-3 bg-slate-50/50 hover:bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                        {parsed?.revisionTag || `Revisi #${idx + 1}`}
                      </span>
                      <span className="font-semibold text-slate-800">{rev.userName}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(rev.createdAt))}
                    </span>
                  </div>
                  {parsed?.reason && (
                    <p className="text-slate-700 italic bg-white p-2 rounded border border-slate-200 text-[11px]">
                      &ldquo;{parsed.reason}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 8. BUTTONS ACTIONS ─── */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <Link
          href={`/purchasing/purchase-orders/${poId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Batal &amp; Kembali ke PO
        </Link>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Menyimpan Revisi...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 stroke-[2.5]" />
              Simpan &amp; Terapkan Revisi ({poNumber} {nextRevTag})
            </>
          )}
        </button>
      </div>
    </form>
  );
}
