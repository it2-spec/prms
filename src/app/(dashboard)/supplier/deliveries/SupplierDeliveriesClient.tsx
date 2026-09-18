"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, statusColor, EmptyState } from "@/components/ui";
import { cancelDelivery } from "./deliveryAction";
import { Search, QrCode, XCircle, AlertTriangle, Loader2 } from "lucide-react";

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

export type DeliveryListItem = {
  id: string;
  deliveryNumber: string;
  suratJalan: string;
  shipDate: string | Date;
  status: string;
  createdAt: string | Date;
  poNumber: string;
  itemCount: number;
  receivingsCount: number;
  items?: Array<{ name: string; code: string; qty: number; unit: string | null }>;
};

export default function SupplierDeliveriesClient({
  deliveries,
}: {
  deliveries: DeliveryListItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // State for cancel confirmation modal
  const [cancelTarget, setCancelTarget] = useState<DeliveryListItem | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const filteredDeliveries = deliveries.filter((d) => {
    if (statusFilter !== "ALL" && d.status !== statusFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchItems = d.items?.some(
      (it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q)
    );
    return (
      d.deliveryNumber.toLowerCase().includes(q) ||
      d.suratJalan.toLowerCase().includes(q) ||
      d.poNumber.toLowerCase().includes(q) ||
      Boolean(matchItems)
    );
  });

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelError(null);

    startTransition(async () => {
      const res = await cancelDelivery(cancelTarget.id);
      if (res?.error) {
        setCancelError(res.error);
      } else {
        setCancelTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nomor delivery, PO, surat jalan, atau nama item (cth: T-2609)..."
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
              <option value="CREATED">Created (Baru)</option>
              <option value="SENT">Sent</option>
              <option value="ARRIVED">Arrived (Diterima)</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Deliveries Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">No. Delivery</th>
                <th className="px-5 py-3 font-medium">PO</th>
                <th className="px-5 py-3 font-medium">Surat Jalan</th>
                <th className="px-5 py-3 font-medium">Tanggal Kirim</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">QR Code</th>
                <th className="px-5 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeliveries.map((d) => {
                const canCancel = d.status === "CREATED" && d.receivingsCount === 0;
                const isCancelled = d.status === "CANCELLED";

                return (
                  <tr
                    key={d.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isCancelled ? "bg-slate-50/50 opacity-75" : ""
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">
                      <span className="font-mono text-xs">{d.deliveryNumber}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-700">{d.poNumber}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800">{d.suratJalan}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDateOnly(d.shipDate)}</td>
                    <td className="px-5 py-3">
                      {d.items && d.items.length > 0 ? (
                        <div className="space-y-0.5 max-w-[200px]">
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                          {d.itemCount} item
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge color={statusColor(d.status)}>
                        {DELIVERY_STATUS_LABEL[d.status] || d.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {isCancelled ? (
                        <span className="text-xs text-slate-400 italic">QR Nonaktif</span>
                      ) : (
                        <Link
                          href={`/supplier/deliveries/${d.id}/qr`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          Lihat QR
                        </Link>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelError(null);
                            setCancelTarget(d);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 hover:border-red-300 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Batalkan
                        </button>
                      ) : isCancelled ? (
                        <span className="text-xs text-slate-400">-</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Terkunci</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredDeliveries.length === 0 && (
          <EmptyState
            message={
              search || statusFilter !== "ALL"
                ? "Tidak ada delivery yang sesuai filter."
                : "Belum ada delivery."
            }
          />
        )}
      </Card>

      {/* Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-800">Batalkan Surat Jalan?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Anda akan membatalkan surat jalan{" "}
                  <strong className="text-slate-900">{cancelTarget.suratJalan}</strong> (
                  {cancelTarget.deliveryNumber}) untuk PO{" "}
                  <strong className="text-slate-900">{cancelTarget.poNumber}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 leading-relaxed">
              <strong>Catatan:</strong> Kuantitas barang yang sebelumnya telah dialokasikan ke
              delivery ini akan dikembalikan secara otomatis ke outstanding Purchase Order,
              sehingga Anda dapat membuat surat jalan baru kembali.
            </div>

            {cancelError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {cancelError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? "Membatalkan..." : "Ya, Batalkan Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
