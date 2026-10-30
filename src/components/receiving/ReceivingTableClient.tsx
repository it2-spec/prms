"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Package,
  DollarSign,
  Truck,
  Layers,
  ArrowUpDown,
  ExternalLink,
  Calendar,
  X,
  FileText,
} from "lucide-react";
import { Card, Badge, statusColor } from "@/components/ui";
import { formatDateOnly, formatMoney } from "@/lib/format";

export interface ReceivingItemRow {
  id: string; // detail id
  receivingId: string;
  receivingNumber: string;
  receivedAt: string; // ISO string
  supplierName: string;
  dnNumber: string; // suratJalan or deliveryNumber
  poNumber: string;
  poId?: string;
  userDept: string; // department or requester
  itemCode: string;
  partName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  picReceiving: string;
  warehouseName: string;
  status: string;
}

interface ReceivingTableClientProps {
  initialRows: ReceivingItemRow[];
  canViewPrice?: boolean;
}

export default function ReceivingTableClient({
  initialRows,
  canViewPrice = true,
}: ReceivingTableClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // List opsi unik Supplier
  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    initialRows.forEach((r) => {
      if (r.supplierName && r.supplierName !== "-") set.add(r.supplierName);
    });
    return Array.from(set).sort();
  }, [initialRows]);

  // List opsi unik Bulan (YYYY-MM)
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    initialRows.forEach((r) => {
      if (r.receivedAt) {
        const d = new Date(r.receivedAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        set.add(`${y}-${m}`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [initialRows]);

  // Filter Data
  const filteredRows = useMemo(() => {
    return initialRows.filter((row) => {
      // 1. Filter Supplier
      if (supplierFilter !== "all" && row.supplierName !== supplierFilter) {
        return false;
      }

      // 2. Filter Bulan
      if (monthFilter !== "all") {
        const d = new Date(row.receivedAt);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (ym !== monthFilter) return false;
      }

      // 3. Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          row.itemCode.toLowerCase().includes(term) ||
          row.partName.toLowerCase().includes(term) ||
          row.poNumber.toLowerCase().includes(term) ||
          row.dnNumber.toLowerCase().includes(term) ||
          row.supplierName.toLowerCase().includes(term) ||
          row.userDept.toLowerCase().includes(term) ||
          row.picReceiving.toLowerCase().includes(term) ||
          row.receivingNumber.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      return true;
    });
  }, [initialRows, searchTerm, supplierFilter, monthFilter]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const totalLines = filteredRows.length;
    let totalQty = 0;
    let totalAmount = 0;
    const uniquePOs = new Set<string>();
    const uniqueSuppliers = new Set<string>();
    const uniqueDNs = new Set<string>();

    filteredRows.forEach((r) => {
      totalQty += r.qty;
      totalAmount += r.totalAmount;
      if (r.poNumber && r.poNumber !== "-") uniquePOs.add(r.poNumber);
      if (r.supplierName && r.supplierName !== "-") uniqueSuppliers.add(r.supplierName);
      if (r.dnNumber && r.dnNumber !== "-") uniqueDNs.add(r.dnNumber);
    });

    return {
      totalLines,
      totalQty,
      totalAmount,
      uniquePOs: uniquePOs.size,
      uniqueSuppliers: uniqueSuppliers.size,
      uniqueDNs: uniqueDNs.size,
    };
  }, [filteredRows]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Reset page saat filter berubah
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleSupplierChange = (val: string) => {
    setSupplierFilter(val);
    setCurrentPage(1);
  };

  const handleMonthChange = (val: string) => {
    setMonthFilter(val);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Baris Item
              </p>
              <p className="text-lg font-bold text-slate-800">
                {stats.totalLines.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-slate-400">item</span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Qty Diterima
              </p>
              <p className="text-lg font-bold text-emerald-700">
                {stats.totalQty.toLocaleString("id-ID")}
              </p>
            </div>
          </div>
        </Card>

        {canViewPrice ? (
          <Card className="p-3.5 bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Amount (Rp)
                </p>
                <p className="text-lg font-bold text-slate-900 font-mono">
                  {formatMoney(stats.totalAmount)}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-3.5 bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Dokumen PO
                </p>
                <p className="text-lg font-bold text-slate-900 font-mono">
                  {stats.uniquePOs}{" "}
                  <span className="text-xs font-normal text-slate-400">PO Terkait</span>
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-3.5 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Supplier & Pengiriman
              </p>
              <p className="text-lg font-bold text-slate-800">
                {stats.uniqueSuppliers}{" "}
                <span className="text-xs font-normal text-slate-400">
                  vendor ({stats.uniqueDNs} Surat Jalan)
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <Card className="p-3 bg-white border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari Code, Part Name, PO No, DN No, Supplier, User..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Bulan */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={monthFilter}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="all">Semua Periode</option>
                {monthOptions.map((ym) => {
                  const [y, m] = ym.split("-");
                  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <option key={ym} value={ym}>
                      {monthName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filter Supplier */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-xs max-w-[200px]">
              <Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={supplierFilter}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-hidden truncate cursor-pointer w-full"
              >
                <option value="all">Semua Supplier</option>
                {supplierOptions.map((spl) => (
                  <option key={spl} value={spl}>
                    {spl}
                  </option>
                ))}
              </select>
            </div>

            {/* Tombol Export Excel */}
            <a
              href={`/api/export/receiving?format=excel`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </a>
          </div>
        </div>
      </Card>

      {/* Main Receiving Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 uppercase tracking-wider font-bold border-b border-slate-200 select-none sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-center border-r border-slate-200 w-12 bg-slate-100">
                  NO
                </th>
                <th className="px-3 py-3 text-center border-r border-slate-200 min-w-[100px] whitespace-nowrap bg-slate-100">
                  RECEIVING DATE
                </th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[170px] bg-slate-100">
                  SUPPLIER NAME
                </th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[130px] whitespace-nowrap bg-slate-100">
                  DN NO.
                </th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[140px] whitespace-nowrap bg-slate-100">
                  PO NO.
                </th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[120px] whitespace-nowrap bg-slate-100">
                  USER
                </th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[110px] whitespace-nowrap bg-slate-100">
                  CODE
                </th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[220px] bg-slate-100">
                  PART NAME
                </th>
                <th className="px-2 py-3 text-center border-r border-slate-200 w-14 bg-slate-100">
                  UNIT
                </th>
                <th className="px-3 py-3 text-right border-r border-slate-200 w-20 bg-slate-100">
                  QTY
                </th>
                {canViewPrice && (
                  <>
                    <th className="px-3 py-3 text-right border-r border-slate-200 min-w-[110px] whitespace-nowrap bg-slate-100">
                      UNIT PRICE
                    </th>
                    <th className="px-3 py-3 text-right border-r border-slate-200 min-w-[120px] whitespace-nowrap bg-slate-100">
                      TOTAL AMOUNT
                    </th>
                  </>
                )}
                <th className="px-3 py-3 border-r border-slate-200 min-w-[130px] whitespace-nowrap bg-slate-100">
                  PIC RECEIVING
                </th>
                <th className="px-2 py-3 text-center w-14 bg-slate-100">
                  DETAIL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={canViewPrice ? 14 : 12} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-9 h-9 stroke-1 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        Tidak ada data penerimaan barang yang cocok.
                      </p>
                      <p className="text-xs text-slate-400">
                        Coba ubah kata kunci pencarian atau sesuaikan filter periode.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-blue-50/40 transition-colors group"
                    >
                      {/* NO */}
                      <td className="px-3 py-2.5 text-center font-mono font-medium text-slate-500 border-r border-slate-100">
                        {rowNumber}
                      </td>

                      {/* RECEIVING DATE */}
                      <td className="px-3 py-2.5 text-center font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">
                        {formatDateOnly(row.receivedAt)}
                      </td>

                      {/* SUPPLIER NAME */}
                      <td className="px-3 py-2.5 font-medium text-slate-800 border-r border-slate-100">
                        {row.supplierName}
                      </td>

                      {/* DN NO. */}
                      <td className="px-3 py-2.5 font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                          {row.dnNumber}
                        </span>
                      </td>

                      {/* PO NO. */}
                      <td className="px-3 py-2.5 font-mono font-semibold text-blue-700 border-r border-slate-100 whitespace-nowrap">
                        {row.poId ? (
                          <Link
                            href={`/purchasing/purchase-orders/${row.poId}`}
                            className="hover:underline hover:text-blue-900"
                            title="Buka Purchase Order"
                          >
                            {row.poNumber}
                          </Link>
                        ) : (
                          row.poNumber
                        )}
                      </td>

                      {/* USER (Department / Requester) */}
                      <td className="px-3 py-2.5 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {row.userDept}
                        </span>
                      </td>

                      {/* CODE */}
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200/60">
                          {row.itemCode}
                        </span>
                      </td>

                      {/* PART NAME */}
                      <td className="px-3 py-2.5 font-medium text-slate-800 border-r border-slate-100">
                        {row.partName}
                      </td>

                      {/* UNIT */}
                      <td className="px-2 py-2.5 text-center text-slate-500 font-mono border-r border-slate-100">
                        {row.unit}
                      </td>

                      {/* QTY */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 border-r border-slate-100">
                        {row.qty.toLocaleString("id-ID")}
                      </td>

                      {canViewPrice && (
                        <>
                          {/* UNIT PRICE */}
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">
                            {formatMoney(row.unitPrice)}
                          </td>

                          {/* TOTAL AMOUNT */}
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 bg-slate-50/50 border-r border-slate-100 whitespace-nowrap">
                            {formatMoney(row.totalAmount)}
                          </td>
                        </>
                      )}

                      {/* PIC RECEIVING */}
                      <td className="px-3 py-2.5 text-slate-700 font-medium border-r border-slate-100 whitespace-nowrap">
                        {row.picReceiving}
                      </td>

                      {/* DETAIL LINK */}
                      <td className="px-2 py-2.5 text-center whitespace-nowrap">
                        <Link
                          href={`/purchasing/receivings/${row.receivingId}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition cursor-pointer"
                          title="Lihat Dokumen Receiving Lengkap"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* FOOTER BARIS GRAND TOTAL */}
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={9} className="px-4 py-3 text-right uppercase tracking-wider text-slate-700">
                    Grand Total ({filteredRows.length.toLocaleString("id-ID")} baris data):
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-300">
                    {stats.totalQty.toLocaleString("id-ID")}
                  </td>
                  {canViewPrice && (
                    <>
                      <td className="px-3 py-3 text-right text-slate-400 font-normal">
                        -
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 bg-slate-200/70 border-r border-slate-300 whitespace-nowrap">
                        {formatMoney(stats.totalAmount)}
                      </td>
                    </>
                  )}
                  <td colSpan={2} className="px-3 py-3 text-slate-500 font-normal"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 font-semibold text-slate-700 cursor-pointer"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>baris per halaman (dari total {filteredRows.length.toLocaleString("id-ID")})</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
