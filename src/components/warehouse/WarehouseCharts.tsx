"use client";

import React, { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Package,
  Layers,
  PieChart,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export interface MonthlyMutationData {
  key: string;
  label: string;
  inBaseQty: number;
  outBaseQty: number;
  inPackageQty: number;
  outPackageQty: number;
  receivingCount: number;
  outgoingCount: number;
}

export interface FulfillmentCategoryData {
  status: string;
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

export interface FastMovingItemData {
  id: string;
  code: string;
  name: string;
  unit: string;
  packageUnit?: string | null;
  outBaseQty: number;
  inBaseQty: number;
  outPackageQty: number;
  primaryDepartment?: string | null;
}

export interface DeptUsageData {
  department: string;
  totalQty: number;
  packageQty: number;
  sharePercent: number;
}

export interface WarehouseChartsProps {
  monthlyMutations: MonthlyMutationData[];
  fulfillmentCategories: FulfillmentCategoryData[];
  fastMovingItems: FastMovingItemData[];
  deptUsage: DeptUsageData[];
  summary: {
    totalInQty: number;
    totalOutQty: number;
    netQty: number;
    totalPos: number;
    closedPos: number;
    fulfillmentRate: number;
  };
}

function formatQtyDisplay(val: number): string {
  if (val == null || isNaN(val)) return "0";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(val);
}

export function WarehouseCharts({
  monthlyMutations,
  fulfillmentCategories,
  fastMovingItems,
  deptUsage,
  summary,
}: WarehouseChartsProps) {
  const [unitMode, setUnitMode] = useState<"base" | "package">("base");
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyMutationData | null>(null);
  const [hoveredFulfillment, setHoveredFulfillment] = useState<FulfillmentCategoryData | null>(null);

  // Perhitungan Nilai Maksimum untuk Skala Batang Grouped
  const maxBase = Math.max(
    ...monthlyMutations.map((d) => Math.max(d.inBaseQty, d.outBaseQty)),
    10
  );
  const maxPkg = Math.max(
    ...monthlyMutations.map((d) => Math.max(d.inPackageQty, d.outPackageQty)),
    5
  );
  const maxScale = unitMode === "base" ? maxBase : maxPkg;

  // Hitung Donut Slices (SVG)
  const totalFulfillmentCount = fulfillmentCategories.reduce((acc, f) => acc + f.count, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const donutSlices = fulfillmentCategories.map((f) => {
    const percent = f.count / totalFulfillmentCount;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -(accumulatedPercent * circumference);
    accumulatedPercent += percent;
    return {
      ...f,
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* ROW 1: Arus Mutasi IN vs OUT (2/3) + Status Realisasi Kedatangan PO (1/3) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* GRAFIK 1: Arus Mutasi Barang (IN vs OUT) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all lg:col-span-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Layers className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  Arus Mutasi Material: Masuk (IN) vs Keluar (OUT)
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Perbandingan kuantitas material masuk dari PO vs pengeluaran ke produksi (6 bulan terakhir)
              </p>
            </div>

            {/* Toggle Satuan: Dasar (kg/ltr) vs Kemasan (Pail/Can) */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setUnitMode("base")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  unitMode === "base"
                    ? "bg-white text-emerald-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Satuan Dasar (kg/ltr)
              </button>
              <button
                type="button"
                onClick={() => setUnitMode("package")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  unitMode === "package"
                    ? "bg-white text-emerald-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Kemasan (Pail/Can)
              </button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50/80 p-3 text-xs sm:gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                <ArrowDownToLine className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Total Masuk (IN)</span>
                <div className="font-extrabold text-emerald-700">
                  {formatQtyDisplay(
                    unitMode === "base"
                      ? summary.totalInQty
                      : monthlyMutations.reduce((a, b) => a + b.inPackageQty, 0)
                  )}{" "}
                  <span className="text-[10px] font-normal text-slate-500">
                    {unitMode === "base" ? "kg/ltr" : "Kemasan"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-100 text-rose-700">
                <ArrowUpFromLine className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Total Keluar (OUT)</span>
                <div className="font-extrabold text-rose-700">
                  {formatQtyDisplay(
                    unitMode === "base"
                      ? summary.totalOutQty
                      : monthlyMutations.reduce((a, b) => a + b.outPackageQty, 0)
                  )}{" "}
                  <span className="text-[10px] font-normal text-slate-500">
                    {unitMode === "base" ? "kg/ltr" : "Kemasan"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Net Flow Mutasi</span>
                <div
                  className={`font-extrabold ${
                    summary.netQty >= 0 ? "text-blue-700" : "text-amber-700"
                  }`}
                >
                  {summary.netQty >= 0 ? "+" : ""}
                  {formatQtyDisplay(summary.netQty)}{" "}
                  <span className="text-[10px] font-normal text-slate-500">
                    {unitMode === "base" ? "kg/ltr" : "Kemasan"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Dual Bar Chart (Grouped Bars) */}
          <div className="mt-6">
            <div className="relative flex h-60 w-full items-end gap-3 sm:gap-6 pt-6 pb-6">
              {/* Garis Grid Horizontal */}
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
                <div className="border-b border-dashed border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatQtyDisplay(maxScale)}
                  </span>
                </div>
                <div className="border-b border-dashed border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatQtyDisplay(maxScale * 0.5)}
                  </span>
                </div>
                <div className="border-b border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono">0</span>
                </div>
              </div>

              {/* Grouped Bars per Month */}
              {monthlyMutations.map((d) => {
                const inVal = unitMode === "base" ? d.inBaseQty : d.inPackageQty;
                const outVal = unitMode === "base" ? d.outBaseQty : d.outPackageQty;

                const inHeight =
                  maxScale > 0
                    ? Math.min(100, Math.max(inVal > 0 ? 8 : 2, (inVal / maxScale) * 100))
                    : 2;
                const outHeight =
                  maxScale > 0
                    ? Math.min(100, Math.max(outVal > 0 ? 8 : 2, (outVal / maxScale) * 100))
                    : 2;

                const isHovered = hoveredMonth?.key === d.key;

                return (
                  <div
                    key={d.key}
                    onMouseEnter={() => setHoveredMonth(d)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="group relative z-10 flex h-full flex-1 flex-col items-center justify-end cursor-pointer"
                  >
                    {/* Tooltip Float Saat Hover */}
                    {isHovered && (
                      <div className="absolute -top-16 z-30 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-center text-xs text-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="font-semibold text-slate-200">{d.label}</div>
                        <div className="flex items-center justify-center gap-3 mt-1 font-mono text-[11px]">
                          <span className="text-emerald-400">
                            IN: {formatQtyDisplay(inVal)} {unitMode === "base" ? "kg" : "Kemasan"}
                          </span>
                          <span className="text-rose-400">
                            OUT: {formatQtyDisplay(outVal)} {unitMode === "base" ? "kg" : "Kemasan"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {d.receivingCount} Incoming · {d.outgoingCount} Outgoing
                        </div>
                        <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    )}

                    {/* Dual Bars Container */}
                    <div className="flex h-full w-full max-w-[56px] items-end justify-center gap-1 sm:gap-1.5">
                      {/* Bar IN (Hijau / Emerald) */}
                      <div
                        style={{ height: `${inHeight}%` }}
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          inVal > 0
                            ? isHovered
                              ? "bg-emerald-600 shadow-md ring-2 ring-emerald-300"
                              : "bg-emerald-500 hover:bg-emerald-600"
                            : "bg-slate-100"
                        }`}
                      />

                      {/* Bar OUT (Merah / Rose) */}
                      <div
                        style={{ height: `${outHeight}%` }}
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          outVal > 0
                            ? isHovered
                              ? "bg-rose-600 shadow-md ring-2 ring-rose-300"
                              : "bg-rose-500 hover:bg-rose-600"
                            : "bg-slate-100"
                        }`}
                      />
                    </div>

                    {/* Label Bulan */}
                    <span
                      className={`mt-2 text-[11px] font-medium transition-colors ${
                        isHovered ? "text-slate-900 font-bold" : "text-slate-500"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend Sederhana */}
            <div className="mt-2 flex items-center justify-center gap-6 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-xs bg-emerald-500" />
                <span>Barang Masuk (IN - Receiving)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-xs bg-rose-500" />
                <span>Barang Keluar (OUT - Outgoing Produksi)</span>
              </div>
            </div>
          </div>
        </div>

        {/* GRAFIK 2: Status Realisasi Kedatangan PO (Donut Chart) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-slate-800">Backlog & Kedatangan PO</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Status penerimaan barang dari pesanan pembelian
            </p>
          </div>

          {/* SVG Donut Visual */}
          <div className="relative my-4 flex items-center justify-center">
            <svg className="h-44 w-44 -rotate-90 transform" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="16"
                fill="transparent"
              />
              {summary.totalPos === 0 ? (
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  className="stroke-slate-200"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray="10 5"
                />
              ) : (
                donutSlices.map((slice) => (
                  <circle
                    key={slice.status}
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke={slice.color}
                    strokeWidth={hoveredFulfillment?.status === slice.status ? "20" : "16"}
                    fill="transparent"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    strokeLinecap="butt"
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredFulfillment(slice)}
                    onMouseLeave={() => setHoveredFulfillment(null)}
                  />
                ))
              )}
            </svg>

            {/* Label Tengah Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              {hoveredFulfillment ? (
                <>
                  <span className="text-xs font-semibold text-slate-500">
                    {hoveredFulfillment.label}
                  </span>
                  <span className="text-xl font-extrabold text-slate-800">
                    {hoveredFulfillment.count} PO
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {Math.round((hoveredFulfillment.count / totalFulfillmentCount) * 100)}% dari total
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-slate-800">
                    {summary.fulfillmentRate}%
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600">Lengkap Diterima</span>
                  <span className="text-[10px] text-slate-400">{summary.totalPos} Total PO</span>
                </>
              )}
            </div>
          </div>

          {/* Legend / Breakdown List */}
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
            {fulfillmentCategories.map((f) => (
              <div
                key={f.status}
                onMouseEnter={() => setHoveredFulfillment(f)}
                onMouseLeave={() => setHoveredFulfillment(null)}
                className={`flex items-center justify-between rounded-md p-1.5 transition-colors cursor-pointer ${
                  hoveredFulfillment?.status === f.status
                    ? "bg-slate-50 font-medium"
                    : "hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: f.color }}
                  />
                  <span className="text-slate-700">{f.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{f.count} PO</span>
                  <span className="text-[10px] text-slate-400">
                    ({Math.round((f.count / totalFulfillmentCount) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: Top Material Pergerakan Tertinggi (1/2) + Pemakaian per Dept (1/2)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* GRAFIK 3: Top Material Pergerakan Tertinggi (Fast Moving Material) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Material Teraktif (Fast-Moving)
                </h3>
                <p className="text-xs text-slate-500">
                  Item dengan frekuensi mutasi keluar tertinggi ke jalur produksi
                </p>
              </div>
            </div>

            <Link
              href="/warehouse/stock"
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Stok Material
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {fastMovingItems.length === 0 ? (
            <div className="my-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              Belum ada mutasi material yang tercatat. Data material teraktif akan terisi otomatis setelah transaksi incoming atau outgoing dilakukan.
            </div>
          ) : (
            <div className="mt-4 space-y-3.5">
              {fastMovingItems.map((item, idx) => {
                const maxOut = fastMovingItems[0]?.outBaseQty || 1;
                const ratioPercent = Math.min(100, Math.max(8, (item.outBaseQty / maxOut) * 100));

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-100 bg-white p-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-800">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.code} {item.packageUnit ? `· Satuan: ${item.packageUnit}` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-rose-600">
                          {formatQtyDisplay(item.outBaseQty)} {item.unit || "kg"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Masuk: {formatQtyDisplay(item.inBaseQty)} {item.unit || "kg"}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar Visual */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${ratioPercent}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GRAFIK 4: Distribusi Pengeluaran per Departemen Pemohon */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <PieChart className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Alokasi Pengeluaran per Departemen
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proporsi penyaluran barang ke departemen produksi & indirect
                  </p>
                </div>
              </div>

              <Link
                href="/warehouse/outgoing/history"
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Riwayat Outgoing
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {deptUsage.length === 0 ? (
              <div className="my-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                Belum ada pengeluaran material ke departemen. Data akan terisi setelah transaksi form Outgoing dibuat.
              </div>
            ) : (
              <div className="mt-4 space-y-3.5">
                {deptUsage.map((dept, idx) => {
                  const colors = [
                    "from-purple-500 to-indigo-600",
                    "from-blue-500 to-cyan-600",
                    "from-emerald-500 to-teal-600",
                    "from-amber-500 to-orange-600",
                    "from-rose-500 to-pink-600",
                  ][idx % 5];

                  return (
                    <div
                      key={dept.department}
                      className="rounded-lg border border-slate-100 bg-white p-3 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">
                            {dept.department}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-slate-800">
                            {formatQtyDisplay(dept.totalQty)}
                          </span>
                          <span className="ml-1 text-xs font-semibold text-purple-600">
                            ({dept.sharePercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar Visual */}
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          style={{ width: `${Math.min(100, Math.max(5, dept.sharePercent))}%` }}
                          className={`h-full rounded-full bg-gradient-to-r ${colors} transition-all duration-500`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-purple-50/50 p-3 text-xs text-purple-900 border border-purple-100">
            💡 <strong>Info Gudang</strong>: Penyeragaman nama departemen (*Painting Plan 1* & *Painting Plan 2*) memastikan alokasi pemakaian material tercatat akurat.
          </div>
        </div>
      </div>
    </div>
  );
}
