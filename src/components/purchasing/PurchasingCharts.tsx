"use client";

import React, { useState } from "react";
import { formatMoney, formatCompactRupiah } from "@/lib/format";
import { TrendingUp, Award, CheckCircle2, Clock, AlertTriangle, FileText, ChevronRight } from "lucide-react";
import Link from "next/link";

export interface MonthlySpendData {
  key: string;
  label: string;
  totalAmount: number;
  poCount: number;
}

export interface PoFulfillmentData {
  status: "CLOSED" | "PARTIAL" | "WAITING" | "DRAFT";
  label: string;
  count: number;
  totalAmount: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface TopSupplierData {
  id: string;
  name: string;
  code: string;
  totalAmount: number;
  poCount: number;
  sharePercent: number;
}

export interface PurchasingChartsProps {
  monthlyData: MonthlySpendData[];
  fulfillmentData: PoFulfillmentData[];
  topSuppliers: TopSupplierData[];
  summary: {
    totalPoCount: number;
    totalSpendAmount: number;
    avgSpendPerMonth: number;
    completionRate: number;
  };
}

export function PurchasingCharts({
  monthlyData,
  fulfillmentData,
  topSuppliers,
  summary,
}: PurchasingChartsProps) {
  const [metricMode, setMetricMode] = useState<"amount" | "count">("amount");
  const [hoveredMonth, setHoveredMonth] = useState<MonthlySpendData | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<PoFulfillmentData | null>(null);

  // Perhitungan Nilai Maksimum untuk Skala Grafik Batang
  const maxAmount = Math.max(...monthlyData.map((d) => d.totalAmount), 1);
  const maxCount = Math.max(...monthlyData.map((d) => d.poCount), 1);
  const maxValue = metricMode === "amount" ? maxAmount : maxCount;

  // Temukan bulan dengan belanja tertinggi
  const peakMonth = monthlyData.reduce(
    (max, cur) => (cur.totalAmount > max.totalAmount ? cur : max),
    monthlyData[0] || { label: "-", totalAmount: 0 }
  );

  // Hitung Donut Slices (SVG)
  const totalFulfillmentCount = fulfillmentData.reduce((acc, f) => acc + f.count, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const donutSlices = fulfillmentData.map((f) => {
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
      {/* ROW 1: Grafik Tren Belanja Bulanan (2/3) + Donut Status Realisasi (1/3)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* GRAFIK 1: Tren Nilai PO Bulanan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all lg:col-span-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">Tren Pengeluaran PO Bulanan</h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Visualisasi arus belanja dan volume pesanan selama 6 bulan terakhir
              </p>
            </div>

            {/* Toggle Switch Metric */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMetricMode("amount")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  metricMode === "amount"
                    ? "bg-white text-blue-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Nominal (Rp)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode("count")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  metricMode === "count"
                    ? "bg-white text-blue-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Volume (PO)
              </button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50/80 p-3 text-xs sm:gap-4">
            <div>
              <span className="text-[11px] text-slate-500">Total Periode Ini</span>
              <div className="mt-0.5 font-bold text-slate-800">
                {metricMode === "amount"
                  ? formatCompactRupiah(summary.totalSpendAmount)
                  : `${summary.totalPoCount} PO`}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Rata-rata / Bulan</span>
              <div className="mt-0.5 font-bold text-blue-600">
                {metricMode === "amount"
                  ? formatCompactRupiah(summary.avgSpendPerMonth)
                  : `${Math.round(summary.totalPoCount / (monthlyData.length || 1))} PO`}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Bulan Tertinggi</span>
              <div className="mt-0.5 font-bold text-emerald-600 truncate">
                {peakMonth.totalAmount > 0
                  ? `${peakMonth.label} (${formatCompactRupiah(peakMonth.totalAmount)})`
                  : "-"}
              </div>
            </div>
          </div>

          {/* Canvas Batang / Chart Area */}
          <div className="mt-6">
            <div className="relative flex h-56 w-full items-end gap-2 sm:gap-4 pt-6 pb-6">
              {/* Garis Grid Horizontal */}
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
                <div className="border-b border-dashed border-slate-200">
                  <span className="text-[10px] text-slate-400">
                    {metricMode === "amount" ? formatCompactRupiah(maxValue) : maxValue}
                  </span>
                </div>
                <div className="border-b border-dashed border-slate-100">
                  <span className="text-[10px] text-slate-400">
                    {metricMode === "amount" ? formatCompactRupiah(maxValue * 0.5) : Math.round(maxValue * 0.5)}
                  </span>
                </div>
                <div className="border-b border-slate-200">
                  <span className="text-[10px] text-slate-400">0</span>
                </div>
              </div>

              {/* Batang Per Bulan */}
              {monthlyData.map((d) => {
                const val = metricMode === "amount" ? d.totalAmount : d.poCount;
                const heightPercent = maxValue > 0 ? Math.min(100, Math.max(val > 0 ? 8 : 2, (val / maxValue) * 100)) : 2;
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
                      <div className="absolute -top-12 z-30 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-center text-xs text-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="font-semibold">{d.label}</div>
                        <div className="text-blue-300 font-mono font-medium">
                          {formatMoney(d.totalAmount)}
                        </div>
                        <div className="text-[10px] text-slate-300">{d.poCount} PO Terbit</div>
                        <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    )}

                    {/* Batang Bar */}
                    <div className="relative w-full max-w-[42px] flex items-end justify-center h-full">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          val > 0
                            ? isHovered
                              ? "bg-gradient-to-t from-blue-600 to-indigo-500 shadow-md ring-2 ring-blue-300"
                              : "bg-gradient-to-t from-blue-500/90 to-blue-400 hover:from-blue-600 hover:to-indigo-500"
                            : "bg-slate-100"
                        }`}
                      />
                    </div>

                    {/* Label Bulan */}
                    <span
                      className={`mt-2 text-[11px] font-medium transition-colors ${
                        isHovered ? "text-blue-600 font-bold" : "text-slate-500"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* GRAFIK 2: Status Realisasi PO (Donut Chart) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-slate-800">Status Realisasi PO</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Rasio pemenuhan kedatangan barang dari vendor
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
              {summary.totalPoCount === 0 ? (
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
                    strokeWidth={hoveredStatus?.status === slice.status ? "20" : "16"}
                    fill="transparent"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    strokeLinecap="butt"
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredStatus(slice)}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                ))
              )}
            </svg>

            {/* Label Tengah Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              {hoveredStatus ? (
                <>
                  <span className="text-xs font-semibold text-slate-500">{hoveredStatus.label}</span>
                  <span className="text-xl font-extrabold text-slate-800">{hoveredStatus.count} PO</span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {formatCompactRupiah(hoveredStatus.totalAmount)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-slate-800">{summary.completionRate}%</span>
                  <span className="text-[11px] font-medium text-emerald-600">Selesai (Closed)</span>
                  <span className="text-[10px] text-slate-400">{summary.totalPoCount} Total PO</span>
                </>
              )}
            </div>
          </div>

          {/* Legend / Breakdown List */}
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
            {fulfillmentData.map((f) => (
              <div
                key={f.status}
                onMouseEnter={() => setHoveredStatus(f)}
                onMouseLeave={() => setHoveredStatus(null)}
                className={`flex items-center justify-between rounded-md p-1.5 transition-colors cursor-pointer ${
                  hoveredStatus?.status === f.status ? "bg-slate-50 font-medium" : "hover:bg-slate-50/50"
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
                  <span className="font-semibold text-slate-800">{f.count}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({formatCompactRupiah(f.totalAmount)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: Grafik Top 5 Supplier Terbesar (Pareto Belanja)                    */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Award className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-slate-800">Top 5 Supplier Terbesar (Pareto Belanja)</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Ranking supplier dengan akumulasi nominal pesanan tertinggi
            </p>
          </div>

          <Link
            href="/purchasing/purchase-orders"
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Lihat Semua PO
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {topSuppliers.length === 0 ? (
          <div className="my-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
            Belum ada transaksi Purchase Order. Data ranking supplier akan otomatis terisi setelah PO dibuat atau diimpor.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {topSuppliers.map((supplier, idx) => {
              const rankStyles = [
                { bg: "bg-amber-100 text-amber-800 border-amber-300 font-extrabold", icon: "🥇" },
                { bg: "bg-slate-200 text-slate-700 border-slate-300 font-bold", icon: "🥈" },
                { bg: "bg-amber-50 text-amber-700 border-amber-200 font-bold", icon: "🥉" },
                { bg: "bg-slate-100 text-slate-600 border-slate-200 font-medium", icon: "#4" },
                { bg: "bg-slate-100 text-slate-600 border-slate-200 font-medium", icon: "#5" },
              ][idx] || { bg: "bg-slate-100 text-slate-600 border-slate-200 font-medium", icon: `#${idx + 1}` };

              return (
                <div
                  key={supplier.id}
                  className="group rounded-lg border border-slate-100 bg-white p-3.5 transition-all hover:border-slate-300 hover:shadow-xs"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Rank & Supplier Info */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs ${rankStyles.bg}`}
                      >
                        {rankStyles.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {supplier.name}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                            {supplier.code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {supplier.poCount} Pesanan Diterbitkan · Kontribusi {supplier.sharePercent.toFixed(1)}% dari total belanja
                        </div>
                      </div>
                    </div>

                    {/* Spend Amount & Share */}
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-extrabold text-slate-800">
                        {formatMoney(supplier.totalAmount)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatCompactRupiah(supplier.totalAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{ width: `${Math.min(100, Math.max(3, supplier.sharePercent))}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-gradient-to-r from-amber-400 to-amber-500"
                          : idx === 1
                          ? "bg-gradient-to-r from-blue-400 to-blue-500"
                          : "bg-gradient-to-r from-indigo-400 to-indigo-500"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
