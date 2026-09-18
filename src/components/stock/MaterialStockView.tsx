"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Calendar,
  Warehouse as WarehouseIcon,
  Search,
  Download,
  RefreshCw,
  Box,
  Truck,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  TrendingDown,
  TrendingUp,
  Scale,
  ArrowRightLeft,
} from "lucide-react";
import { Card, PageTitle } from "@/components/ui";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface DailyInDetailItem {
  receivingNumber: string;
  poNumber: string;
  supplierName: string;
  packageQty: number;
  baseQty: number;
}

interface DailyOutDetailItem {
  outgoingNumber: string;
  purpose?: string | null;
  department?: string | null;
  createdByName?: string;
  packageQty: number;
  baseQty: number;
}

interface StockItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  packageUnit: string;
  packageSize: number;
  initialStockPkgQty: number;
  initialStockBaseQty: number;
  totalInPkgQty: number;
  totalInBaseQty: number;
  totalOutPkgQty: number;
  totalOutBaseQty: number;
  balancePkgQty: number;
  balanceBaseQty: number;
  dailyIn: Record<number, number>;
  dailyOut: Record<number, number>;
  dailyInBase: Record<number, number>;
  dailyOutBase: Record<number, number>;
  dailyInDetails: Record<number, DailyInDetailItem[]>;
  dailyOutDetails: Record<number, DailyOutDetailItem[]>;
}

interface StockResponse {
  month: string;
  daysInMonth: number;
  warehouseId: string;
  summary: {
    totalItems: number;
    totalReceivings: number;
    totalOutgoings: number;
    totalInitialStockPkgQty: number;
    totalInitialStockBaseQty: number;
    totalInPkgQty: number;
    totalInBaseQty: number;
    totalOutPkgQty: number;
    totalOutBaseQty: number;
    totalBalancePkgQty: number;
    totalBalanceBaseQty: number;
  };
  dailyGrandTotal: {
    inPkg: Record<number, number>;
    outPkg: Record<number, number>;
    inBase: Record<number, number>;
    outBase: Record<number, number>;
    in: Record<number, number>;
    out: Record<number, number>;
  };
  items: StockItem[];
}

interface MaterialStockViewProps {
  warehouses: WarehouseOption[];
  initialWarehouseId?: string;
  userRole: "PURCHASING" | "WAREHOUSE";
}

export default function MaterialStockView({
  warehouses,
  initialWarehouseId = "all",
  userRole,
}: MaterialStockViewProps) {
  // Default bulan saat ini YYYY-MM
  const currentMonthStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(initialWarehouseId);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [stockData, setStockData] = useState<StockResponse | null>(null);

  // Toggle Mode Satuan: "package" (Kemasan: Pail/Can/Drum) vs "base" (Satuan Dasar: kg/ltr/pcs)
  const [unitMode, setUnitMode] = useState<"package" | "base">("package");

  // Navigasi bulan (Prev / Next)
  const changeMonth = (offset: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${nextY}-${nextM}`);
  };

  // Fetch data
  const fetchData = async (m: string, wId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stock?month=${encodeURIComponent(m)}&warehouseId=${encodeURIComponent(wId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setStockData(data);
      }
    } catch (err) {
      console.error("Gagal mengambil data stok material:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMonth, selectedWarehouse);
  }, [selectedMonth, selectedWarehouse]);

  // Filter pencarian lokal di client
  const filteredItems = (stockData?.items || []).filter((it) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      it.itemCode.toLowerCase().includes(term) ||
      it.itemName.toLowerCase().includes(term) ||
      it.packageUnit.toLowerCase().includes(term) ||
      it.unit.toLowerCase().includes(term)
    );
  });

  // Array hari 1..daysInMonth
  const daysInMonth = stockData?.daysInMonth || 31;
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Tanggal hari ini
  const today = new Date();
  const isCurrentMonthNow =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}` === selectedMonth;
  const todayDateNumber = today.getDate();

  // Format title bulan
  const formatMonthTitle = (monthStr: string) => {
    const [y, m] = monthStr.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  };

  // Handler Export Excel
  const handleExportExcel = () => {
    const params = new URLSearchParams({
      month: selectedMonth,
      warehouseId: selectedWarehouse,
      unitMode: unitMode,
    });
    window.open(`/api/export/stock?${params.toString()}`, "_blank");
  };

  const isBase = unitMode === "base";

  return (
    <div className="space-y-5">
      {/* Page Title & Action */}
      <PageTitle
        title="Stok Material Gudang"
        subtitle={`Kartu mutasi harian masuk & keluar (IN / OUT) serta saldo ${isBase ? "satuan dasar (kg/ltr)" : "kemasan"} per ${formatMonthTitle(selectedMonth)}`}
        action={
          <div className="flex items-center gap-2.5">
            {/* Tombol Cepat Switch Satuan di Header Action */}
            <button
              onClick={() => setUnitMode((prev) => (prev === "package" ? "base" : "package"))}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold transition shadow-xs cursor-pointer"
              title={`Beralih ke tampilan ${isBase ? "Satuan Kemasan" : "Satuan Dasar"}`}
            >
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <span>
                Ubah ke: <strong className="text-blue-700">{isBase ? "Qty Kemasan" : "Qty Satuan"}</strong>
              </span>
            </button>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-medium transition shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        }
      />

      {/* Control Bar: Filter Periode Bulan, Gudang, Satuan & Pencarian */}
      <Card bodyClassName="!p-4 bg-white border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* 1. Filter Periode Bulan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Periode Bulan</span>
            </label>
            <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-1.5 hover:bg-white text-slate-600 rounded-md transition shadow-2xs cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                className="w-full bg-transparent px-2 text-sm font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              />
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-1.5 hover:bg-white text-slate-600 rounded-md transition shadow-2xs cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Filter Gudang */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <WarehouseIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Lokasi Gudang</span>
            </label>
            <div className="relative">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer appearance-none"
              >
                <option value="all">🏢 Semua Gudang</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    📍 {w.name} ({w.code})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </div>

          {/* 3. Toggle Mode Satuan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              <span>Satuan Tampilan</span>
            </label>
            <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setUnitMode("package")}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                  !isBase
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Tampilkan kuantitas dalam Satuan Kemasan (Pail, Can, Drum)"
              >
                <Box className="w-3.5 h-3.5" />
                <span>Kemasan</span>
              </button>
              <button
                type="button"
                onClick={() => setUnitMode("base")}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                  isBase
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Tampilkan kuantitas dalam Satuan Dasar (kg, ltr, pcs)"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Satuan Dasar</span>
              </button>
            </div>
          </div>

          {/* 4. Pencarian Material */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Cari Material</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ketik kode / nama item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-slate-50 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Statistics (Stok Awal + Masuk - Keluar = Saldo Akhir) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card bodyClassName="!p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800">
                {stockData?.summary.totalItems ?? 0}
              </div>
              <div className="text-xs text-slate-500">Jenis Material</div>
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800">
                {isBase
                  ? (stockData?.summary.totalInitialStockBaseQty ?? 0).toLocaleString("id-ID")
                  : (stockData?.summary.totalInitialStockPkgQty ?? 0).toLocaleString("id-ID")}
              </div>
              <div className="text-xs text-slate-500">
                Stok Awal ({isBase ? "Satuan Dasar" : "Kemasan"})
              </div>
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-700">
                {isBase
                  ? (stockData?.summary.totalInBaseQty ?? 0).toLocaleString("id-ID")
                  : (stockData?.summary.totalInPkgQty ?? 0).toLocaleString("id-ID")}
              </div>
              <div className="text-xs text-slate-500">
                Masuk ({stockData?.summary.totalReceivings ?? 0} Rcv)
              </div>
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-orange-600">
                {isBase
                  ? (stockData?.summary.totalOutBaseQty ?? 0).toLocaleString("id-ID")
                  : (stockData?.summary.totalOutPkgQty ?? 0).toLocaleString("id-ID")}
              </div>
              <div className="text-xs text-slate-500">
                Keluar ({stockData?.summary.totalOutgoings ?? 0} Out)
              </div>
            </div>
          </div>
        </Card>

        <Card bodyClassName="!p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-teal-700">
                {isBase
                  ? (stockData?.summary.totalBalanceBaseQty ?? 0).toLocaleString("id-ID")
                  : (stockData?.summary.totalBalancePkgQty ?? 0).toLocaleString("id-ID")}
              </div>
              <div className="text-xs text-slate-500">
                Stok Akhir ({isBase ? "Satuan Dasar" : "Kemasan"})
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Matriks Table Card */}
      <Card className="overflow-hidden border border-slate-200">
        {/* Header Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider">
              Kartu Matriks Mutasi Material - {formatMonthTitle(selectedMonth)}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono font-medium">
              {filteredItems.length} Item
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium text-[11px]">
              Tampilan: <b>{isBase ? "Qty Satuan Dasar (kg/ltr/pcs)" : "Qty Kemasan (Pail/Can/Drum)"}</b>
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500"></span>
              <span>Baris <b>IN</b>: Masuk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded bg-orange-500"></span>
              <span>Baris <b>OUT</b>: Keluar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded bg-red-400"></span>
              <span>Weekend</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-sm">Memuat data mutasi stok material...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Box className="w-10 h-10 stroke-1 text-slate-300" />
            <div className="text-sm font-medium text-slate-600">
              Tidak ada aktivitas mutasi material pada {formatMonthTitle(selectedMonth)}
            </div>
            <div className="text-xs text-slate-400 max-w-sm">
              Silakan pilih bulan lain atau ubah filter lokasi gudang.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto relative shadow-inner">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 select-none">
                <tr>
                  {/* Sticky No */}
                  <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2.5 text-center font-bold border-r border-slate-200 w-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                    No.
                  </th>

                  {/* Sticky Item */}
                  <th className="sticky left-10 z-20 bg-slate-100 px-3 py-2.5 font-bold border-r border-slate-200 min-w-[220px] max-w-[260px] shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)]">
                    Item Material
                  </th>

                  {/* Stok Awal */}
                  <th
                    className="px-2.5 py-2.5 text-center font-bold border-r border-slate-200 min-w-[80px] bg-slate-100"
                    title={`Stok awal bulan dalam ${isBase ? "satuan dasar" : "satuan kemasan"}`}
                  >
                    Stok Awal
                  </th>

                  {/* Mutasi IN/OUT */}
                  <th className="px-1.5 py-2.5 text-center font-bold border-r border-slate-200 w-12 min-w-[48px] bg-slate-100">
                    Tipe
                  </th>

                  {/* Kolom Tanggal 1..31 */}
                  {daysArray.map((day) => {
                    const [y, m] = selectedMonth.split("-").map(Number);
                    const dayDate = new Date(y, m - 1, day);
                    const dayOfWeek = dayDate.getDay(); // 0 = Minggu, 6 = Sabtu
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const dayName = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][dayOfWeek];
                    const isToday = isCurrentMonthNow && day === todayDateNumber;

                    return (
                      <th
                        key={day}
                        className={`px-1 py-1.5 text-center font-bold border-r min-w-[34px] w-[34px] transition-colors ${
                          isToday
                            ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400 border-amber-300 z-10"
                            : isWeekend
                            ? "bg-red-100/80 text-red-600 border-red-200"
                            : "border-slate-200 text-slate-700"
                        }`}
                        title={`${dayName}, ${day} ${formatMonthTitle(selectedMonth)}`}
                      >
                        <div className="leading-tight">{day}</div>
                        <div
                          className={`text-[9px] font-normal leading-none mt-0.5 ${
                            isWeekend ? "text-red-600 font-semibold" : "text-slate-400"
                          }`}
                        >
                          {dayName}
                        </div>
                      </th>
                    );
                  })}

                  {/* Total Mutasi Bulan Ini */}
                  <th className="px-3 py-2.5 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[80px] bg-slate-100">
                    Total Mutasi
                  </th>

                  {/* Stok Akhir / Aktual */}
                  <th
                    className="sticky right-0 z-20 bg-teal-50 px-3 py-2.5 text-center font-bold text-teal-800 border-l border-teal-200 min-w-[85px] shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)]"
                    title="Stok Aktual = Stok Awal + Total Masuk - Total Keluar"
                  >
                    Stok Akhir
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredItems.map((item, idx) => {
                  const initialStockVal = isBase ? item.initialStockBaseQty : item.initialStockPkgQty;
                  const balanceVal = isBase ? item.balanceBaseQty : item.balancePkgQty;
                  const unitDisplay = isBase ? item.unit : item.packageUnit;

                  return (
                    <React.Fragment key={item.itemId}>
                      {/* BARIS 1: MUTASI MASUK (IN) */}
                      <tr className="hover:bg-slate-50/70 transition-colors group">
                        {/* Sticky No (rowSpan 2) */}
                        <td
                          rowSpan={2}
                          className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/70 px-3 py-2 text-center font-mono text-slate-400 border-r border-b border-slate-200 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] align-middle"
                        >
                          {idx + 1}
                        </td>

                        {/* Sticky Item (rowSpan 2) */}
                        <td
                          rowSpan={2}
                          className="sticky left-10 z-10 bg-white group-hover:bg-slate-50/70 px-3 py-2 border-r border-b border-slate-200 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] align-middle"
                        >
                          <div className="flex items-baseline gap-1.5 truncate">
                            <span className="font-mono font-bold text-blue-700 text-[11px] shrink-0">
                              {item.itemCode}
                            </span>
                            <span className="font-medium text-slate-800 truncate" title={item.itemName}>
                              {item.itemName}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            1 {item.packageUnit} = {item.packageSize} {item.unit}
                          </div>
                        </td>

                        {/* Stok Awal Bulan (rowSpan 2) */}
                        <td
                          rowSpan={2}
                          className="px-2 py-2 text-center font-mono font-bold text-slate-800 bg-slate-50/80 border-r border-b border-slate-200 align-middle"
                        >
                          <div className="text-xs">{initialStockVal.toLocaleString("id-ID")}</div>
                          <div className="text-[9px] font-normal text-slate-400">{unitDisplay}</div>
                        </td>

                        {/* Tipe IN */}
                        <td className="px-1.5 py-1 text-center border-r border-slate-200 bg-emerald-50/40">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                            IN
                          </span>
                        </td>

                        {/* Nilai IN per Tanggal 1..31 */}
                        {daysArray.map((day) => {
                          const [y, m] = selectedMonth.split("-").map(Number);
                          const dayDate = new Date(y, m - 1, day);
                          const dayOfWeek = dayDate.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const inVal = isBase ? item.dailyInBase[day] : item.dailyIn[day];
                          const inPkg = item.dailyIn[day] || 0;
                          const inBaseVal = item.dailyInBase[day] || 0;
                          const inDetails = item.dailyInDetails[day] || [];
                          const isToday = isCurrentMonthNow && day === todayDateNumber;

                          return (
                            <td
                              key={`in-${day}`}
                              className={`px-1 py-1 text-center font-mono border-r relative group/cell transition-colors ${
                                isToday
                                  ? "bg-amber-50/60 border-amber-200"
                                  : isWeekend
                                  ? "bg-red-50/50 border-red-100"
                                  : "border-slate-100"
                              }`}
                            >
                              {inVal ? (
                                <div
                                  className="inline-flex items-center justify-center w-full py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer shadow-xs"
                                  title={`IN Tanggal ${day}: ${inPkg} ${item.packageUnit} (${inBaseVal} ${item.unit})\n${inDetails
                                    .map(
                                      (d) =>
                                        `• ${d.receivingNumber} (+${d.packageQty} ${item.packageUnit} / ${d.baseQty} ${item.unit}) - ${d.supplierName}`
                                    )
                                    .join("\n")}`}
                                >
                                  {inVal}
                                </div>
                              ) : (
                                <span className={isWeekend ? "text-red-300 select-none" : "text-slate-300 select-none"}>
                                  -
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* Total Masuk Bulan Ini */}
                        <td className="px-2.5 py-1 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40 border-r border-slate-200">
                          +{(isBase ? item.totalInBaseQty : item.totalInPkgQty).toLocaleString("id-ID")}
                        </td>

                        {/* Stok Akhir / Aktual (rowSpan 2) */}
                        <td
                          rowSpan={2}
                          className="sticky right-0 z-10 bg-teal-50/95 px-3 py-2 text-center font-mono font-bold text-teal-900 border-l border-b border-teal-200 shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] align-middle"
                        >
                          <div className="text-sm font-bold text-teal-800">
                            {balanceVal.toLocaleString("id-ID")}
                          </div>
                          <div className="text-[9px] font-normal text-teal-600">{unitDisplay}</div>
                        </td>
                      </tr>

                      {/* BARIS 2: MUTASI KELUAR (OUT) */}
                      <tr className="hover:bg-slate-50/70 transition-colors group border-b border-slate-200">
                        {/* Tipe OUT */}
                        <td className="px-1.5 py-1 text-center border-r border-slate-200 bg-orange-50/40">
                          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold text-[10px]">
                            OUT
                          </span>
                        </td>

                        {/* Nilai OUT per Tanggal 1..31 */}
                        {daysArray.map((day) => {
                          const [y, m] = selectedMonth.split("-").map(Number);
                          const dayDate = new Date(y, m - 1, day);
                          const dayOfWeek = dayDate.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const outVal = isBase ? item.dailyOutBase[day] : item.dailyOut[day];
                          const outPkg = item.dailyOut[day] || 0;
                          const outBaseVal = item.dailyOutBase[day] || 0;
                          const outDetails = item.dailyOutDetails[day] || [];
                          const isToday = isCurrentMonthNow && day === todayDateNumber;

                          return (
                            <td
                              key={`out-${day}`}
                              className={`px-1 py-1 text-center font-mono border-r relative group/cell transition-colors ${
                                isToday
                                  ? "bg-amber-50/60 border-amber-200"
                                  : isWeekend
                                  ? "bg-red-50/50 border-red-100"
                                  : "border-slate-100"
                              }`}
                            >
                              {outVal ? (
                                <div
                                  className="inline-flex items-center justify-center w-full py-0.5 rounded bg-orange-100 text-orange-800 font-bold hover:bg-orange-600 hover:text-white transition-colors cursor-pointer shadow-xs"
                                  title={`OUT Tanggal ${day}: ${outPkg} ${item.packageUnit} (${outBaseVal} ${item.unit})\n${outDetails
                                    .map(
                                      (d) =>
                                        `• ${d.outgoingNumber} (-${d.packageQty} ${item.packageUnit} / ${d.baseQty} ${item.unit}) ${d.department ? `[${d.department}]` : ""} ${d.purpose ? `: ${d.purpose}` : ""}`
                                    )
                                    .join("\n")}`}
                                >
                                  {outVal}
                                </div>
                              ) : (
                                <span className={isWeekend ? "text-red-300 select-none" : "text-slate-300 select-none"}>
                                  -
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* Total Keluar Bulan Ini */}
                        <td className="px-2.5 py-1 text-center font-mono font-bold text-orange-700 bg-orange-50/40 border-r border-slate-200">
                          -{(isBase ? item.totalOutBaseQty : item.totalOutPkgQty).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* FOOTER TOTAL MUTASI HARIAN */}
              <tfoot className="bg-slate-100 font-bold text-slate-800 select-none border-t-2 border-slate-300 divide-y divide-slate-200">
                {/* Footer Baris 1: Grand Total IN */}
                <tr>
                  <td colSpan={3} className="sticky left-0 z-20 bg-slate-100 px-3 py-2 text-right font-bold text-slate-700 border-r border-slate-200">
                    Grand Total Masuk (IN)
                  </td>
                  <td className="px-1 py-1 text-center border-r border-slate-200 bg-emerald-50/60">
                    <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[9px]">IN</span>
                  </td>
                  {daysArray.map((day) => {
                    const [y, m] = selectedMonth.split("-").map(Number);
                    const dayDate = new Date(y, m - 1, day);
                    const dayOfWeek = dayDate.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const totIn = isBase
                      ? stockData?.dailyGrandTotal.inBase?.[day] || 0
                      : stockData?.dailyGrandTotal.inPkg?.[day] || 0;

                    return (
                      <td
                        key={`tot-in-${day}`}
                        className={`px-1 py-1.5 text-center font-mono text-[11px] border-r ${
                          isWeekend ? "bg-red-100/70 text-red-800" : "text-emerald-700 border-slate-200"
                        }`}
                      >
                        {totIn > 0 ? totIn : "-"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center font-mono text-xs font-bold text-emerald-700 bg-emerald-100/60 border-r border-emerald-200">
                    +{isBase
                      ? (stockData?.summary.totalInBaseQty ?? 0).toLocaleString("id-ID")
                      : (stockData?.summary.totalInPkgQty ?? 0).toLocaleString("id-ID")}
                  </td>
                  <td
                    rowSpan={2}
                    className="sticky right-0 z-20 bg-teal-100 px-3 py-2 text-center font-mono text-sm font-bold text-teal-900 border-l border-teal-300 shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] align-middle"
                  >
                    {isBase
                      ? (stockData?.summary.totalBalanceBaseQty ?? 0).toLocaleString("id-ID")
                      : (stockData?.summary.totalBalancePkgQty ?? 0).toLocaleString("id-ID")}
                  </td>
                </tr>

                {/* Footer Baris 2: Grand Total OUT */}
                <tr>
                  <td colSpan={3} className="sticky left-0 z-20 bg-slate-100 px-3 py-2 text-right font-bold text-slate-700 border-r border-slate-200">
                    Grand Total Keluar (OUT)
                  </td>
                  <td className="px-1 py-1 text-center border-r border-slate-200 bg-orange-50/60">
                    <span className="px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-bold text-[9px]">OUT</span>
                  </td>
                  {daysArray.map((day) => {
                    const [y, m] = selectedMonth.split("-").map(Number);
                    const dayDate = new Date(y, m - 1, day);
                    const dayOfWeek = dayDate.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const totOut = isBase
                      ? stockData?.dailyGrandTotal.outBase?.[day] || 0
                      : stockData?.dailyGrandTotal.outPkg?.[day] || 0;

                    return (
                      <td
                        key={`tot-out-${day}`}
                        className={`px-1 py-1.5 text-center font-mono text-[11px] border-r ${
                          isWeekend ? "bg-red-100/70 text-red-800" : "text-orange-700 border-slate-200"
                        }`}
                      >
                        {totOut > 0 ? totOut : "-"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center font-mono text-xs font-bold text-orange-700 bg-orange-100/60 border-r border-orange-200">
                    -{isBase
                      ? (stockData?.summary.totalOutBaseQty ?? 0).toLocaleString("id-ID")
                      : (stockData?.summary.totalOutPkgQty ?? 0).toLocaleString("id-ID")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
