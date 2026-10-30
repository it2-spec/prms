"use client";

import React, { useState } from "react";
import {
  GitCommit,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Truck,
  Package,
  Layers,
  AlertTriangle,
  Flame,
  ChevronRight,
  TrendingUp,
  FileCheck,
} from "lucide-react";
import Link from "next/link";

export interface MonthlyPrData {
  key: string;
  label: string;
  totalPrs: number;
  completedPrs: number;
  inProgressPrs: number;
  pendingPrs: number;
  totalItems: number;
}

export interface FunnelStageData {
  stage: string;
  label: string;
  count: number;
  itemCount: number;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  description: string;
}

export interface DeptShareData {
  department: string;
  count: number;
  itemCount: number;
  sharePercent: number;
  color: string;
}

export interface ActivePrItemTracking {
  id: string;
  prNumber: string;
  department: string;
  itemName: string;
  qty: number;
  unit: string;
  urgency: "NORMAL" | "URGENT";
  status: string;
  poNumber?: string | null;
  supplierName?: string | null;
}

export interface DepartmentChartsProps {
  monthlyPrs: MonthlyPrData[];
  funnelStages: FunnelStageData[];
  deptShares: DeptShareData[];
  activeTrackingItems: ActivePrItemTracking[];
  summary: {
    totalPrCount: number;
    pendingApprovalCount: number;
    approvedReadyPoCount: number;
    orderedCount: number;
    completedCount: number;
    completionRate: number;
    urgentCount: number;
  };
}

export function DepartmentCharts({
  monthlyPrs,
  funnelStages,
  deptShares,
  activeTrackingItems,
  summary,
}: DepartmentChartsProps) {
  const [metricMode, setMetricMode] = useState<"prs" | "items">("prs");
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyPrData | null>(null);
  const [hoveredDept, setHoveredDept] = useState<DeptShareData | null>(null);

  // Perhitungan Nilai Maksimum Skala Grafik Batang
  const maxPrs = Math.max(...monthlyPrs.map((d) => d.totalPrs), 5);
  const maxItems = Math.max(...monthlyPrs.map((d) => d.totalItems), 10);
  const maxScale = metricMode === "prs" ? maxPrs : maxItems;

  // Donut SVG Calculations for Dept Distribution
  const totalDeptPrCount = deptShares.reduce((a, b) => a + b.count, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const donutSlices = deptShares.map((d) => {
    const percent = d.count / totalDeptPrCount;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -(accumulatedPercent * circumference);
    accumulatedPercent += percent;
    return {
      ...d,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* GRAFIK 1: PIPELINE & FUNNEL STATUS PERMINTAAN (LIFECYCLE PR)             */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <GitCommit className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-slate-800">
                Alur Siklus Permintaan (PR Lifecycle Funnel)
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Pelacakan posisi Purchase Request dari pengajuan awal hingga barang tiba di gudang
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {summary.completionRate}% Selesai (Completed)
            </span>
          </div>
        </div>

        {/* Funnel Progress Steps */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {funnelStages.map((stage, idx) => {
            const icons = [Clock, FileCheck, ShoppingBag, Truck, CheckCircle2];
            const StageIcon = icons[idx] || GitCommit;

            return (
              <div
                key={stage.stage}
                className={`relative rounded-xl border p-4 transition-all hover:shadow-sm ${stage.bgColor} ${stage.borderColor}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${stage.textColor}`}>
                    Tahap {idx + 1}
                  </span>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg shadow-2xs"
                    style={{ backgroundColor: stage.color, color: "white" }}
                  >
                    <StageIcon className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-800">
                    {stage.count}{" "}
                    <span className="text-xs font-medium text-slate-500">PR</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">{stage.label}</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">
                    {stage.description}
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-200/60 pt-2 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                  <span>{stage.itemCount} Item Barang</span>
                  <span>{Math.round((stage.count / (summary.totalPrCount || 1)) * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: Tren Pengajuan Bulanan (2/3) + Proporsi Departemen Pemohon (1/3)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* GRAFIK 2: Tren Pengajuan PR Bulanan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all lg:col-span-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  Tren Pengajuan Permintaan Bulanan
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Aktivitas pembuatan PR dan status penyelesaiannya dalam 6 bulan terakhir
              </p>
            </div>

            {/* Metric Toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMetricMode("prs")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  metricMode === "prs"
                    ? "bg-white text-indigo-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Jumlah Dokumen (PR)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode("items")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  metricMode === "items"
                    ? "bg-white text-indigo-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Kuantitas Item (Barang)
              </button>
            </div>
          </div>

          {/* Canvas Chart Batang */}
          <div className="mt-6">
            <div className="relative flex h-56 w-full items-end gap-3 sm:gap-6 pt-6 pb-6">
              {/* Garis Grid Horizontal */}
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
                <div className="border-b border-dashed border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono">{maxScale}</span>
                </div>
                <div className="border-b border-dashed border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Math.round(maxScale * 0.5)}
                  </span>
                </div>
                <div className="border-b border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono">0</span>
                </div>
              </div>

              {/* Batang per Bulan */}
              {monthlyPrs.map((d) => {
                const totalVal = metricMode === "prs" ? d.totalPrs : d.totalItems;
                const completedVal = metricMode === "prs" ? d.completedPrs : 0;
                const inProgressVal = metricMode === "prs" ? d.inProgressPrs : 0;
                const pendingVal = metricMode === "prs" ? d.pendingPrs : 0;

                const heightPercent =
                  maxScale > 0
                    ? Math.min(100, Math.max(totalVal > 0 ? 8 : 2, (totalVal / maxScale) * 100))
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
                        <div className="font-bold text-indigo-300 mt-0.5">
                          Total: {d.totalPrs} PR ({d.totalItems} Item)
                        </div>
                        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-300 mt-1">
                          <span className="text-emerald-400 font-semibold">{d.completedPrs} Selesai</span>
                          <span>·</span>
                          <span className="text-blue-400">{d.inProgressPrs} Proses</span>
                          <span>·</span>
                          <span className="text-amber-400">{d.pendingPrs} Pending</span>
                        </div>
                        <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    )}

                    {/* Stacked Bar Container */}
                    <div className="flex h-full w-full max-w-[42px] items-end justify-center">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-300 flex flex-col-reverse overflow-hidden ${
                          totalVal > 0
                            ? isHovered
                              ? "ring-2 ring-indigo-400 shadow-md"
                              : ""
                            : "bg-slate-100"
                        }`}
                      >
                        {/* Completed portion (Hijau) */}
                        <div
                          style={{
                            height: totalVal > 0 ? `${(completedVal / totalVal) * 100}%` : "0%",
                          }}
                          className="bg-emerald-500 w-full transition-all"
                        />
                        {/* In Progress portion (Biru) */}
                        <div
                          style={{
                            height: totalVal > 0 ? `${(inProgressVal / totalVal) * 100}%` : "0%",
                          }}
                          className="bg-blue-500 w-full transition-all"
                        />
                        {/* Pending portion (Kuning/Amber) */}
                        <div
                          style={{
                            height: totalVal > 0 ? `${(pendingVal / totalVal) * 100}%` : "0%",
                          }}
                          className="bg-amber-400 w-full transition-all"
                        />
                      </div>
                    </div>

                    {/* Label Bulan */}
                    <span
                      className={`mt-2 text-[11px] font-medium transition-colors ${
                        isHovered ? "text-indigo-600 font-bold" : "text-slate-500"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend Stacked */}
            <div className="mt-2 flex items-center justify-center gap-5 border-t border-slate-100 pt-3 text-xs text-slate-600 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-emerald-500" />
                <span>Selesai (Barang Tiba)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-blue-500" />
                <span>Proses PO & Pengiriman</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-amber-400" />
                <span>Menunggu Approval / Draft</span>
              </div>
            </div>
          </div>
        </div>

        {/* GRAFIK 3: Proporsi Departemen Pemohon */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Layers className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-slate-800">Distribusi per Departemen</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Proporsi permintaan antar departemen / unit pemohon
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
              {deptShares.length === 0 ? (
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
                    key={slice.department}
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke={slice.color}
                    strokeWidth={hoveredDept?.department === slice.department ? "20" : "16"}
                    fill="transparent"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    strokeLinecap="butt"
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredDept(slice)}
                    onMouseLeave={() => setHoveredDept(null)}
                  />
                ))
              )}
            </svg>

            {/* Label Tengah Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              {hoveredDept ? (
                <>
                  <span className="text-[11px] font-bold text-slate-700 truncate max-w-[100px]">
                    {hoveredDept.department}
                  </span>
                  <span className="text-xl font-extrabold text-slate-800">
                    {hoveredDept.count} PR
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {hoveredDept.sharePercent.toFixed(1)}% porsi
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-slate-800">
                    {summary.totalPrCount}
                  </span>
                  <span className="text-[11px] font-medium text-purple-600">Total PR</span>
                  <span className="text-[10px] text-slate-400">{deptShares.length} Departemen</span>
                </>
              )}
            </div>
          </div>

          {/* Breakdown List */}
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs max-h-48 overflow-y-auto">
            {deptShares.map((d) => (
              <div
                key={d.department}
                onMouseEnter={() => setHoveredDept(d)}
                onMouseLeave={() => setHoveredDept(null)}
                className={`flex items-center justify-between rounded-md p-1.5 transition-colors cursor-pointer ${
                  hoveredDept?.department === d.department
                    ? "bg-slate-50 font-medium"
                    : "hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-slate-700 truncate">{d.department}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-slate-800">{d.count} PR</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({d.sharePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 3: TRACKING KEDATANGAN BARANG PR ("KAPAN BARANG SAYA TIBA?")          */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Truck className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-slate-800">
                Tracking Kedatangan Barang Aktif
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Pantau status item PR yang sedang diproses PO atau sedang dalam pengiriman supplier
            </p>
          </div>

          <Link
            href="/purchasing/purchase-requests"
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Buka Daftar PR Lengkap
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {activeTrackingItems.length === 0 ? (
          <div className="my-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
            Tidak ada item PR yang sedang menunggu pengiriman. Semua barang yang diajukan telah selesai diterima atau belum diterbitkan PO.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
            {activeTrackingItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800 truncate">
                      {item.itemName}
                    </span>
                    {item.urgency === "URGENT" && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        <Flame className="h-3 w-3 text-rose-500" />
                        URGENT
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-slate-700">{item.prNumber}</span>
                    <span>·</span>
                    <span className="font-medium text-slate-600">{item.department}</span>
                    {item.poNumber && (
                      <>
                        <span>·</span>
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          PO: {item.poNumber}
                        </span>
                      </>
                    )}
                    {item.supplierName && (
                      <span className="text-slate-400">({item.supplierName})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-slate-800">
                      {item.qty} {item.unit}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.status === "ORDERED"
                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                        : item.status === "PARTIAL_RECEIVED"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {item.status === "ORDERED"
                      ? "Menunggu Vendor"
                      : item.status === "PARTIAL_RECEIVED"
                      ? "Diterima Sebagian"
                      : item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
