"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge, statusColor } from "@/components/ui";
import {
  Truck,
  PackageCheck,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";

function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(d)
  );
}

function formatMoney(
  n: number | { toString(): string } | null | undefined
): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export type DeliveryItemData = {
  id: string;
  qty: number;
  unitPrice: number;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string | null;
    packageUnit: string | null;
    packageSize: number | null;
  };
};

export type DeliveryData = {
  id: string;
  deliveryNumber: string;
  suratJalan: string;
  shipDate: string;
  status: string;
  supplier?: { name: string } | null;
  details: DeliveryItemData[];
  receivings?: Array<{
    id: string;
    receivingNumber: string;
    status: string;
    receivedAt: string;
    warehouse?: { name: string } | null;
  }>;
};

export type ReceivingItemData = {
  id: string;
  qtyReceived: number;
  qtyDelivered: number;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string | null;
    packageUnit: string | null;
    packageSize: number | null;
  };
};

export type ReceivingData = {
  id: string;
  receivingNumber: string;
  receivedAt: string;
  status: string;
  warehouse?: { name: string } | null;
  delivery?: {
    id: string;
    deliveryNumber: string;
    suratJalan: string;
  } | null;
  details: ReceivingItemData[];
};

export type PoItemSummary = {
  id: string;
  itemId: string;
  name: string;
  code: string;
  qty: number;
  unit: string | null;
  packageUnit: string | null;
  packageSize: number | null;
  receivedQty: number;
};

interface Props {
  deliveries: DeliveryData[];
  receivings: ReceivingData[];
  poItems: PoItemSummary[];
}

type ViewTab = "table" | "cards" | "by-item";

export default function PoDeliveryReceivingView({
  deliveries,
  receivings,
  poItems,
}: Props) {
  const [activeTab, setActiveTab] = useState<ViewTab>("table");
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("all");
  const [expandedDeliveryIds, setExpandedDeliveryIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedReceivingIds, setExpandedReceivingIds] = useState<Set<string>>(
    new Set()
  );

  // Toggle single accordion
  const toggleDelivery = (id: string) => {
    setExpandedDeliveryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleReceiving = (id: string) => {
    setExpandedReceivingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand / Collapse all
  const expandAllDeliveries = () => {
    if (expandedDeliveryIds.size === deliveries.length) {
      setExpandedDeliveryIds(new Set());
    } else {
      setExpandedDeliveryIds(new Set(deliveries.map((d) => d.id)));
    }
  };

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const matchSearch =
        search === "" ||
        d.suratJalan.toLowerCase().includes(search.toLowerCase()) ||
        d.deliveryNumber.toLowerCase().includes(search.toLowerCase()) ||
        d.details.some((dt) =>
          dt.item.name.toLowerCase().includes(search.toLowerCase())
        );

      const matchItem =
        selectedItemId === "all" ||
        d.details.some((dt) => dt.item.id === selectedItemId);

      return matchSearch && matchItem;
    });
  }, [deliveries, search, selectedItemId]);

  // Combined flat rows for the all-in-one table view
  const combinedShipments = useMemo(() => {
    const rows: Array<{
      deliveryId: string;
      deliveryNumber: string;
      suratJalan: string;
      shipDate: string;
      deliveryStatus: string;
      receivingId?: string;
      receivingNumber?: string;
      receivingStatus?: string;
      warehouseName?: string;
      item: {
        id: string;
        code: string;
        name: string;
        unit: string | null;
        packageUnit: string | null;
        packageSize: number | null;
      };
      qtyDelivered: number;
      qtyReceived: number;
    }> = [];

    for (const d of deliveries) {
      const rcv = d.receivings?.[0];
      for (const det of d.details) {
        if (selectedItemId !== "all" && det.item.id !== selectedItemId) continue;

        if (
          search &&
          !d.suratJalan.toLowerCase().includes(search.toLowerCase()) &&
          !d.deliveryNumber.toLowerCase().includes(search.toLowerCase()) &&
          !det.item.name.toLowerCase().includes(search.toLowerCase())
        ) {
          continue;
        }

        // Find corresponding received qty in receiving details
        let rcvQty = det.qty;
        if (rcv) {
          const fullRcv = receivings.find((r) => r.id === rcv.id);
          const rcvDet = fullRcv?.details.find(
            (rd) => rd.item.id === det.item.id
          );
          if (rcvDet) rcvQty = rcvDet.qtyReceived;
        }

        rows.push({
          deliveryId: d.id,
          deliveryNumber: d.deliveryNumber,
          suratJalan: d.suratJalan,
          shipDate: d.shipDate,
          deliveryStatus: d.status,
          receivingId: rcv?.id,
          receivingNumber: rcv?.receivingNumber,
          receivingStatus: rcv?.status,
          warehouseName: rcv?.warehouse?.name,
          item: det.item,
          qtyDelivered: det.qty,
          qtyReceived: rcvQty,
        });
      }
    }

    // Sort by shipDate ascending (chronological order)
    return rows.sort(
      (a, b) => new Date(a.shipDate).getTime() - new Date(b.shipDate).getTime()
    );
  }, [deliveries, receivings, search, selectedItemId]);

  // Total summary of filtered shipments
  const totalFilteredDelivered = useMemo(() => {
    return combinedShipments.reduce((acc, row) => acc + row.qtyDelivered, 0);
  }, [combinedShipments]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      {/* Header bar with title, search, filter and tabs */}
      <div className="border-b border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Riwayat Pengiriman & Penerimaan
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {deliveries.length} Pengiriman ({combinedShipments.length} Baris Item)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pantau seluruh riwayat surat jalan dan barang yang tiba tanpa perlu membuka satu per satu.
            </p>
          </div>

          {/* View switcher tabs */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-lg self-start md:self-auto text-xs font-medium text-slate-600">
            <button
              onClick={() => setActiveTab("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeTab === "table"
                  ? "bg-white text-blue-700 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Tabel Rekapitulasi (Praktis)
            </button>
            <button
              onClick={() => setActiveTab("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeTab === "cards"
                  ? "bg-white text-blue-700 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Per Surat Jalan (Kartu)
            </button>
            <button
              onClick={() => setActiveTab("by-item")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeTab === "by-item"
                  ? "bg-white text-blue-700 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Per Barang (Matrix)
            </button>
          </div>
        </div>

        {/* Search & Item Filter controls */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-200/60">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Surat Jalan, No. Delivery, atau nama item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Semua Barang ({poItems.length})</option>
              {poItems.map((item) => (
                <option key={item.itemId} value={item.itemId}>
                  {item.name} ({item.receivedQty} / {item.qty} {item.unit || "kg"})
                </option>
              ))}
            </select>
          </div>

          {activeTab === "cards" && (
            <button
              onClick={expandAllDeliveries}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded"
            >
              {expandedDeliveryIds.size === deliveries.length
                ? "Tutup Semua Detail"
                : "Buka Semua Detail"}
            </button>
          )}
        </div>
      </div>

      {/* CONTENT AREA 1: ALL-IN-ONE REKAP TABLE (Paling Cepat & Praktis) */}
      {activeTab === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center w-12">No</th>
                <th className="px-4 py-3">Surat Jalan</th>
                <th className="px-4 py-3">Tanggal Kirim</th>
                <th className="px-4 py-3">Barang (Item)</th>
                <th className="px-4 py-3 text-right">Qty Terkirim</th>
                <th className="px-4 py-3 text-right">Qty Diterima</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Dokumen Terkait</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {combinedShipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada data pengiriman yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                combinedShipments.map((row, idx) => {
                  const pkgUnit = row.item.packageUnit || "Pail";
                  const pkgSize = Number(row.item.packageSize ?? 1);
                  const pkgDelivered =
                    pkgSize > 0
                      ? Math.round((row.qtyDelivered / pkgSize) * 10) / 10
                      : row.qtyDelivered;
                  const pkgReceived =
                    pkgSize > 0
                      ? Math.round((row.qtyReceived / pkgSize) * 10) / 10
                      : row.qtyReceived;

                  return (
                    <tr
                      key={`${row.deliveryId}-${row.item.id}-${idx}`}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono text-xs">
                          {row.suratJalan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDateOnly(row.shipDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {row.item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {row.item.code} · Spek: 1 {pkgUnit} = {pkgSize}{" "}
                          {row.item.unit || "kg"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-slate-700">
                        <div>
                          {row.qtyDelivered} {row.item.unit || "kg"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ({pkgDelivered} {pkgUnit})
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-emerald-600">
                        <div>
                          {row.qtyReceived} {row.item.unit || "kg"}
                        </div>
                        <div className="text-[11px] text-emerald-500 font-normal">
                          ({pkgReceived} {pkgUnit})
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge color={statusColor(row.receivingStatus || row.deliveryStatus)}>
                          {row.receivingStatus || row.deliveryStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/purchasing/deliveries/${row.deliveryId}`}
                            className="font-mono text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            title="Buka Delivery"
                          >
                            {row.deliveryNumber}
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>
                          {row.receivingNumber && (
                            <>
                              <span className="text-slate-300">/</span>
                              <Link
                                href={`/purchasing/receivings/${row.receivingId}`}
                                className="font-mono text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1"
                                title="Buka Receiving"
                              >
                                {row.receivingNumber}
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {combinedShipments.length > 0 && (
              <tfoot className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right">
                    Total Qty Terkirim:
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-700">
                    {totalFilteredDelivered}
                  </td>
                  <td colSpan={3} className="px-4 py-2.5 text-slate-500 font-normal">
                    (Terhitung dari {combinedShipments.length} baris pengiriman yang tampil)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* CONTENT AREA 2: ACCORDION CARDS VIEW (Ringkas + Bisa Expand di Tempat) */}
      {activeTab === "cards" && (
        <div className="p-4 sm:p-5 space-y-3">
          {filteredDeliveries.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Tidak ada delivery yang cocok.
            </div>
          ) : (
            filteredDeliveries.map((dlv) => {
              const isExpanded = expandedDeliveryIds.has(dlv.id);
              const totalItemsInDlv = dlv.details.reduce((s, i) => s + i.qty, 0);

              return (
                <div
                  key={dlv.id}
                  className={`border rounded-lg transition-all overflow-hidden ${
                    isExpanded
                      ? "border-blue-300 bg-blue-50/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  {/* Card Header clickable to expand */}
                  <div
                    onClick={() => toggleDelivery(dlv.id)}
                    className="p-3.5 sm:px-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <button className="text-slate-400 hover:text-slate-600 mt-0.5 sm:mt-0">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 font-mono text-sm">
                            {dlv.deliveryNumber}
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded font-mono font-medium">
                            SJ: {dlv.suratJalan}
                          </span>
                          <Badge color={statusColor(dlv.status)}>
                            {dlv.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Kirim: {formatDateOnly(dlv.shipDate)}
                          </span>
                          <span>·</span>
                          <span className="font-medium text-slate-700">
                            {dlv.details.length} Jenis Barang (Total {totalItemsInDlv})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Item Pills Preview directly on the card */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-[340px]">
                        {dlv.details.map((det) => (
                          <span
                            key={det.id}
                            className="text-[11px] font-medium bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-700 shadow-2xs"
                          >
                            {det.item.name}: <strong>{det.qty} {det.item.unit || "kg"}</strong>
                          </span>
                        ))}
                      </div>

                      <Link
                        href={`/purchasing/deliveries/${dlv.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded flex items-center gap-1 shrink-0"
                      >
                        Detail Halaman <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Item Table in-place */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/80 bg-white p-3 sm:p-4">
                      <table className="w-full text-left text-xs border border-slate-100 rounded">
                        <thead className="bg-slate-50 text-slate-500 font-semibold">
                          <tr>
                            <th className="px-3 py-2">Barang</th>
                            <th className="px-3 py-2 text-right">Qty Terkirim</th>
                            <th className="px-3 py-2 text-right">Konversi Kemasan</th>
                            <th className="px-3 py-2 text-right">Harga Satuan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dlv.details.map((det) => {
                            const pkgUnit = det.item.packageUnit || "Pail";
                            const pkgSize = Number(det.item.packageSize ?? 1);
                            const pkgQty =
                              pkgSize > 0
                                ? Math.round((det.qty / pkgSize) * 100) / 100
                                : det.qty;

                            return (
                              <tr key={det.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {det.item.name}
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {det.item.code}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-700">
                                  {det.qty} {det.item.unit || "kg"}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500">
                                  {pkgQty} {pkgUnit} (1 {pkgUnit} = {pkgSize} {det.item.unit || "kg"})
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">
                                  {formatMoney(det.unitPrice)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CONTENT AREA 3: BY-ITEM MATRIX VIEW (Timeline akumulasi per item) */}
      {activeTab === "by-item" && (
        <div className="p-4 sm:p-5 space-y-6">
          {poItems.map((poItem) => {
            // Find all shipments for this item
            const itemShipments = combinedShipments.filter(
              (s) => s.item.id === poItem.itemId
            );
            const totalRecv = itemShipments.reduce((acc, s) => acc + s.qtyReceived, 0);
            const percent = Math.min(100, Math.round((totalRecv / poItem.qty) * 100));

            return (
              <div
                key={poItem.itemId}
                className="border border-slate-200 rounded-lg p-4 bg-white shadow-2xs"
              >
                {/* Header item with progress bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {poItem.name}
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">
                      {poItem.code} · Kemasan: 1 {poItem.packageUnit || "Pail"} = {poItem.packageSize ?? 1} {poItem.unit || "kg"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-emerald-600">
                        {totalRecv} / {poItem.qty} {poItem.unit || "kg"} ({percent}%)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {poItem.packageSize && poItem.packageSize > 0
                          ? `${Math.floor(totalRecv / poItem.packageSize)} / ${Math.round(poItem.qty / poItem.packageSize)} ${poItem.packageUnit || "Pail"}`
                          : ""}
                      </div>
                    </div>
                    <div className="w-24 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percent >= 100 ? "bg-emerald-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Shipments timeline breakdown */}
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Rincian {itemShipments.length} Pengiriman:
                  </div>

                  {itemShipments.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-2">
                      Belum ada catatan pengiriman untuk item ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {itemShipments.map((s, sIdx) => {
                        const pkgSize = Number(s.item.packageSize ?? 1);
                        const pkgs =
                          pkgSize > 0
                            ? Math.round((s.qtyDelivered / pkgSize) * 10) / 10
                            : s.qtyDelivered;

                        return (
                          <div
                            key={sIdx}
                            className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200/70 text-xs"
                          >
                            <div>
                              <div className="font-mono font-bold text-slate-800">
                                {s.suratJalan}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                {formatDateOnly(s.shipDate)}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-600">
                                +{s.qtyDelivered} {s.item.unit || "kg"}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                ({pkgs} {s.item.packageUnit || "Pail"})
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
