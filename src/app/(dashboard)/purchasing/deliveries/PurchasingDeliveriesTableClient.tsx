"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge, statusColor, EmptyState } from "@/components/ui";
import { Search } from "lucide-react";

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  CREATED: "Created",
  SENT: "Sent",
  ARRIVED: "Arrived",
  CANCELLED: "Dibatalkan",
};

function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(d));
}

export type PurchasingDeliveryItem = {
  id: string;
  deliveryNumber: string;
  poNumber: string;
  supplierName: string;
  suratJalan: string;
  shipDate: string | Date;
  receivingsCount: number;
  status: string;
  items: Array<{ name: string; code: string; qty: number; unit: string | null }>;
};

export default function PurchasingDeliveriesTableClient({
  deliveries,
}: {
  deliveries: PurchasingDeliveryItem[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredDeliveries = deliveries.filter((d) => {
    if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
    if (!search.trim()) return true;

    const q = search.toLowerCase();
    const matchItems = d.items.some(
      (it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q),
    );

    return (
      d.deliveryNumber.toLowerCase().includes(q) ||
      d.poNumber.toLowerCase().includes(q) ||
      d.supplierName.toLowerCase().includes(q) ||
      d.suratJalan.toLowerCase().includes(q) ||
      matchItems
    );
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. Delivery, PO, Supplier, Surat Jalan, atau Nama Item (cth: T-2609)..."
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
              <option value="ALL">Semua Status</option>
              <option value="CREATED">Created</option>
              <option value="SENT">Sent</option>
              <option value="ARRIVED">Arrived</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Delivery</th>
                <th className="px-5 py-3 font-medium">PO</th>
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Surat Jalan</th>
                <th className="px-5 py-3 font-medium">Tanggal Kirim</th>
                <th className="px-5 py-3 font-medium">Item Pengiriman</th>
                <th className="px-5 py-3 font-medium">Receiving</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeliveries.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/purchasing/deliveries/${d.id}`}
                      className="text-blue-600 font-mono hover:underline"
                    >
                      {d.deliveryNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-700">{d.poNumber}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-800">{d.supplierName}</td>
                  <td className="px-5 py-3 font-medium text-slate-800">{d.suratJalan}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDateOnly(d.shipDate)}</td>
                  <td className="px-5 py-3">
                    {d.items.length > 0 ? (
                      <div className="space-y-0.5 max-w-[220px]">
                        <div className="text-xs font-medium text-slate-800 truncate" title={d.items[0].name}>
                          {d.items[0].name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {d.items[0].qty.toLocaleString("id-ID")} {d.items[0].unit || "kg"}
                          {d.items.length > 1 && (
                            <span className="ml-1 text-blue-600 font-medium">
                              (+{d.items.length - 1} item lagi)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                      {d.receivingsCount} RCV
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge color={statusColor(d.status)}>
                      {DELIVERY_STATUS_LABEL[d.status] || d.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDeliveries.length === 0 && (
          <EmptyState
            message={
              search || statusFilter !== "ALL"
                ? "Tidak ada delivery yang cocok dengan kriteria pencarian/filter."
                : "Belum ada delivery."
            }
          />
        )}
      </Card>
    </div>
  );
}
