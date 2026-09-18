"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PackagePlus,
  PackageMinus,
  Search,
  ChevronRight,
  Calendar,
  Building2,
  Clock,
  QrCode,
  FileText,
  RotateCcw,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { Badge, Card, EmptyState, statusColor } from "@/components/ui";
import { RECEIVING_STATUS_LABEL, formatDateOnly, formatDate } from "@/lib/format";
import { cancelOutgoing } from "../outgoing/outgoingAction";

type ReceivingItem = {
  id: string;
  receivingNumber: string;
  deliveryNumber: string;
  poNumber: string;
  supplierName: string;
  warehouseName: string;
  receivedAt: string;
  isManual: boolean;
  status: string;
  itemCount: number;
};

type OutgoingItem = {
  id: string;
  outgoingNumber: string;
  issuedAt: string;
  itemCode: string;
  itemName: string;
  packageQty: number;
  packageUnit: string;
  baseQty: number;
  unit: string;
  purpose: string | null;
  department: string | null;
  createdByName: string;
  status: "COMPLETED" | "CANCELLED";
  cancelledAt?: string | null;
  cancelReason?: string | null;
};

interface HistoryTabsClientProps {
  initialTab?: "receiving" | "outgoing";
  receivings: ReceivingItem[];
  outgoings: OutgoingItem[];
  warehouseName?: string;
}

export default function HistoryTabsClient({
  initialTab = "receiving",
  receivings,
  outgoings,
  warehouseName,
}: HistoryTabsClientProps) {
  const [activeTab, setActiveTab] = useState<"receiving" | "outgoing">(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [outgoingList, setOutgoingList] = useState<OutgoingItem[]>(outgoings);

  // Modal Pembatalan
  const [cancelTarget, setCancelTarget] = useState<OutgoingItem | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Filter Masuk
  const filteredReceivings = receivings.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.receivingNumber.toLowerCase().includes(term) ||
      r.deliveryNumber.toLowerCase().includes(term) ||
      r.poNumber.toLowerCase().includes(term) ||
      r.supplierName.toLowerCase().includes(term) ||
      r.warehouseName.toLowerCase().includes(term)
    );
  });

  // Filter Keluar (bisa cari nama material / kode / no outgoing)
  const filteredOutgoings = outgoingList.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.outgoingNumber.toLowerCase().includes(term) ||
      o.itemCode.toLowerCase().includes(term) ||
      o.itemName.toLowerCase().includes(term) ||
      (o.purpose && o.purpose.toLowerCase().includes(term)) ||
      (o.department && o.department.toLowerCase().includes(term)) ||
      o.createdByName.toLowerCase().includes(term)
    );
  });

  async function handleExecuteCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await cancelOutgoing(cancelTarget.id, cancelReasonInput);
      if (res.error) {
        setCancelError(res.error);
      } else {
        setOutgoingList((prev) =>
          prev.map((it) =>
            it.id === cancelTarget.id
              ? {
                  ...it,
                  status: "CANCELLED",
                  cancelledAt: new Date().toISOString(),
                  cancelReason: cancelReasonInput.trim() || "Dibatalkan petugas gudang",
                }
              : it,
          ),
        );
        setNotificationMsg(
          `Transaksi ${cancelTarget.outgoingNumber} berhasil dibatalkan. Stok otomatis dikembalikan ke gudang.`,
        );
        setCancelTarget(null);
      }
    } catch {
      setCancelError("Gagal membatalkan transaksi pengeluaran.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <span>{notificationMsg}</span>
          <button
            type="button"
            onClick={() => setNotificationMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Tab Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        {/* Tabs Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab("receiving")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-xs transition cursor-pointer ${
              activeTab === "receiving"
                ? "bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PackagePlus className={`w-4 h-4 ${activeTab === "receiving" ? "text-emerald-600" : "text-slate-400"}`} />
            <span>Barang Masuk (Receiving)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "receiving"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {receivings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("outgoing")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-xs transition cursor-pointer ${
              activeTab === "outgoing"
                ? "bg-white text-orange-700 shadow-xs ring-1 ring-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PackageMinus className={`w-4 h-4 ${activeTab === "outgoing" ? "text-orange-600" : "text-slate-400"}`} />
            <span>Barang Keluar (Outgoing)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "outgoing"
                  ? "bg-orange-100 text-orange-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {outgoings.length}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative sm:w-72">
          <input
            type="text"
            placeholder={
              activeTab === "receiving"
                ? "Cari no receiving, PO, supplier..."
                : "Cari no outgoing, tujuan, dept..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* TAB 1: BARANG MASUK (RECEIVING) */}
      {activeTab === "receiving" && (
        <Card className="overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="px-4 py-3 font-bold">No. Receiving</th>
                  <th className="px-4 py-3 font-bold">No. Delivery</th>
                  <th className="px-4 py-3 font-bold">No. PO</th>
                  <th className="px-4 py-3 font-bold">Supplier</th>
                  <th className="px-4 py-3 font-bold">Gudang</th>
                  <th className="px-4 py-3 font-bold text-center">Tanggal Masuk</th>
                  <th className="px-4 py-3 font-bold text-center">Mode</th>
                  <th className="px-4 py-3 font-bold text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceivings.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">
                      <Link href={`/purchasing/receivings/${r.id}`} className="hover:underline">
                        {r.receivingNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{r.deliveryNumber}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">{r.poNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.supplierName}</td>
                    <td className="px-4 py-3 text-slate-600">{r.warehouseName}</td>
                    <td className="px-4 py-3 text-center text-slate-500 font-mono">
                      {formatDateOnly(r.receivedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.isManual ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium text-[10px]">
                          <FileText className="w-3 h-3" /> Manual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium text-[10px]">
                          <QrCode className="w-3 h-3" /> Scan QR
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={statusColor(r.status)}>
                        {RECEIVING_STATUS_LABEL[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/purchasing/receivings/${r.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium text-xs transition"
                      >
                        Detail <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReceivings.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <PackagePlus className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium">Belum ada riwayat barang masuk</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {searchTerm ? "Tidak ada data yang cocok dengan pencarian" : "Transaksi receiving akan muncul di sini"}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: BARANG KELUAR (OUTGOING) */}
      {activeTab === "outgoing" && (
        <Card className="overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none font-bold">
                <tr>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3 text-center">Waktu Keluar</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3 text-center">Qty Keluar</th>
                  <th className="px-4 py-3">Tujuan / Dept</th>
                  <th className="px-4 py-3">Dicatat Oleh</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOutgoings.map((o) => {
                  const isCancelled = o.status === "CANCELLED";
                  return (
                    <tr
                      key={o.id}
                      className={`transition ${
                        isCancelled ? "bg-red-50/25 opacity-80" : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold">
                        <Link
                          href={`/warehouse/outgoing/history/${o.id}`}
                          className={`hover:underline ${
                            isCancelled ? "line-through text-slate-400" : "text-violet-700"
                          }`}
                        >
                          {o.outgoingNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 font-mono">
                        {formatDate(o.issuedAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isCancelled ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                              DIBATALKAN
                            </span>
                            {o.cancelReason && (
                              <span
                                className="text-[10px] text-red-600 truncate max-w-[120px] mt-0.5"
                                title={o.cancelReason}
                              >
                                {o.cancelReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            SELESAI
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-bold ${isCancelled ? "line-through text-slate-400" : "text-slate-800"}`}>
                          {o.itemName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{o.itemCode}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div
                          className={`font-mono font-bold text-sm ${
                            isCancelled ? "line-through text-slate-400" : "text-orange-700"
                          }`}
                        >
                          {o.packageQty} {o.packageUnit}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          (= {o.baseQty} {o.unit})
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {o.department ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {o.department}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {o.createdByName}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Link
                            href={`/warehouse/outgoing/history/${o.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-violet-50 text-slate-700 hover:text-violet-700 font-medium text-xs transition"
                          >
                            Detail <ChevronRight className="w-3 h-3" />
                          </Link>

                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTarget(o);
                                setCancelReasonInput("");
                                setCancelError(null);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs transition cursor-pointer border border-red-200 shadow-2xs"
                              title="Batalkan transaksi ini dan kembalikan stok ke gudang"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Batalkan</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredOutgoings.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <PackageMinus className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium">Belum ada riwayat barang keluar</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {searchTerm ? "Tidak ada data yang cocok dengan pencarian" : "Transaksi outgoing akan muncul di sini"}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Modal Konfirmasi Pembatalan Transaksi */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-red-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-slate-900 text-base">Batalkan Transaksi Outgoing</h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1">
                <span>Konfirmasi Sistem:</span>
              </div>
              <p>
                Transaksi <strong>{cancelTarget.outgoingNumber}</strong> (
                <strong>{cancelTarget.itemName}</strong> - {cancelTarget.packageQty}{" "}
                {cancelTarget.packageUnit}) akan ditandai <strong>DIBATALKAN</strong>.
              </p>
              <p className="text-emerald-800 font-bold bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 mt-1">
                ✓ Stok material ini akan otomatis dikembalikan ke saldo gudang seketika.
              </p>
            </div>

            {cancelError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                {cancelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alasan Pembatalan
              </label>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Contoh: Salah scan part, salah jumlah, atau pembatalan dari user"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleExecuteCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya, Batalkan Transaksi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
