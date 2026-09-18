"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge, statusColor, EmptyState } from "@/components/ui";
import { Search, Eye, Truck, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const PO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Dikirim ke Supplier",
  WAITING_DELIVERY: "Menunggu Pengiriman",
  PARTIALLY_DELIVERED: "Terkirim Sebagian",
  WAITING_RECEIVING: "Menunggu Penerimaan Gudang",
  PARTIALLY_RECEIVED: "Diterima Sebagian",
  RECEIVED: "Diterima Penuh",
  CLOSED: "Closed",
  REVISED: "Direvisi",
  CANCELLED: "Dibatalkan (Cancelled)",
};

function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(d));
}

export type SupplierPOItem = {
  id: string;
  poNumber: string;
  poDate: string | Date;
  status: string;
  notes: string | null;
  warehouseName: string;
  totalItems: number;
  totalOrderedQty: number;
  totalDeliveredQty: number;
  totalReceivedQty: number;
  outstandingQty: number;
  isDeliverable: boolean;
  supplierAcceptedAt?: string | Date | null;
  supplierAcceptedByName?: string | null;
  items?: Array<{ name: string; code: string; qty: number; unit: string | null }>;
};

export default function SupplierPoTableClient({
  purchaseOrders,
}: {
  purchaseOrders: SupplierPOItem[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredPOs = purchaseOrders.filter((po) => {
    if (statusFilter !== "ALL" && po.status !== statusFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchItems = po.items?.some(
      (it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q)
    );
    return (
      po.poNumber.toLowerCase().includes(q) ||
      po.warehouseName.toLowerCase().includes(q) ||
      (po.notes && po.notes.toLowerCase().includes(q)) ||
      Boolean(matchItems)
    );
  });

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nomor PO, gudang tujuan, atau nama barang (cth: T-2609)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">Semua Status PO</option>
              <option value="WAITING_DELIVERY">Menunggu Pengiriman</option>
              <option value="PARTIALLY_DELIVERED">Terkirim Sebagian</option>
              <option value="WAITING_RECEIVING">Menunggu Penerimaan Gudang</option>
              <option value="PARTIALLY_RECEIVED">Diterima Sebagian</option>
              <option value="CLOSED">Closed</option>
              <option value="RECEIVED">Received</option>
            </select>
          </div>
        </div>
      </Card>

      {/* PO Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">No. PO</th>
                <th className="px-5 py-3 font-medium">Tanggal PO</th>
                <th className="px-5 py-3 font-medium">Gudang Tujuan</th>
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Progress Pengiriman</th>
                <th className="px-5 py-3 font-medium">Status PO</th>
                <th className="px-5 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPOs.map((po) => {
                const percentReceived =
                  po.totalOrderedQty > 0
                    ? Math.min(100, Math.round((po.totalReceivedQty / po.totalOrderedQty) * 100))
                    : 0;
                const percentDelivered =
                  po.totalOrderedQty > 0
                    ? Math.min(100, Math.round((po.totalDeliveredQty / po.totalOrderedQty) * 100))
                    : 0;

                const isClosed = po.status === "CLOSED";

                return (
                  <tr
                    key={po.id}
                    className={`hover:bg-slate-50 transition-colors ${isClosed ? "bg-slate-50/40" : ""
                      }`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">
                      <Link
                        href={`/supplier/purchase-orders/${po.id}`}
                        className="font-mono text-sm text-blue-600 hover:underline flex items-center gap-1.5"
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDateOnly(po.poDate)}</td>
                    <td className="px-5 py-3 text-slate-700 font-medium">{po.warehouseName}</td>
                    <td className="px-5 py-3">
                      {po.items && po.items.length > 0 ? (
                        <div className="space-y-0.5 max-w-[200px]">
                          <div className="text-xs font-medium text-slate-800 truncate" title={po.items[0].name}>
                            {po.items[0].name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {po.items[0].qty.toLocaleString("id-ID")} {po.items[0].unit || "kg"}
                            {po.items.length > 1 && (
                              <span className="ml-1 text-blue-600 font-medium">
                                (+{po.items.length - 1} item lagi)
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                          {po.totalItems} item
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 min-w-[200px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Diterima: <strong className="text-slate-800">{po.totalReceivedQty}</strong> / {po.totalOrderedQty}
                          </span>
                          <span className="font-semibold text-slate-700">{percentReceived}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all duration-300 ${isClosed
                                ? "bg-emerald-500"
                                : percentReceived > 0
                                  ? "bg-blue-500"
                                  : percentDelivered > 0
                                    ? "bg-amber-400"
                                    : "bg-slate-200"
                              }`}
                            style={{ width: `${percentReceived}%` }}
                          />
                        </div>
                        {po.outstandingQty > 0 && (
                          <div className="text-[11px] text-amber-600 font-medium">
                            Sisa kirim: {po.outstandingQty} kg
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-1">
                        <Badge color={statusColor(po.status)}>
                          {PO_STATUS_LABEL[po.status] || po.status}
                        </Badge>
                        <div>
                          {po.supplierAcceptedAt ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sudah TTD</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Belum TTD</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/supplier/purchase-orders/${po.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          Detail
                        </Link>
                        {po.isDeliverable && (
                          <Link
                            href={`/supplier/deliveries/new?po=${po.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Kirim
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPOs.length === 0 && (
          <EmptyState
            message={
              search || statusFilter !== "ALL"
                ? "Tidak ada PO yang cocok dengan kriteria pencarian/filter."
                : "Belum ada Purchase Order untuk supplier Anda."
            }
          />
        )}
      </Card>
    </div>
  );
}
