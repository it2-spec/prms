import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { formatDateOnly, PO_STATUS_LABEL, DELIVERY_STATUS_LABEL, RECEIVING_STATUS_LABEL } from "@/lib/utils";
import {
  FileText,
  Truck,
  ArrowLeft,
  Package,
  QrCode,
  Warehouse,
  Calendar,
  CheckCircle2,
  Clock,
  PenTool,
  XCircle,
} from "lucide-react";
import SupplierSignPoModal from "@/components/supplier/SupplierSignPoModal";

export const dynamic = "force-dynamic";

export default async function SupplierPoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) redirect("/login");

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      warehouse: true,
      details: {
        include: { item: true },
      },
      deliveries: {
        orderBy: { createdAt: "desc" },
        include: {
          details: { include: { item: true } },
          receivings: true,
        },
      },
      receivings: {
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: true,
          details: { include: { item: true } },
        },
      },
    },
  });

  if (!po || po.supplierId !== dbUser.supplierId) {
    notFound();
  }

  const totalOrdered = po.details.reduce((s, d) => s + d.qty, 0);
  const totalDelivered = po.details.reduce((s, d) => s + d.deliveredQty, 0);
  const totalReceived = po.details.reduce((s, d) => s + d.receivedQty, 0);
  const totalOutstanding = Math.max(0, totalOrdered - totalDelivered);

  const isDeliverable =
    ["WAITING_DELIVERY", "PARTIALLY_DELIVERED", "SENT", "PARTIALLY_RECEIVED"].includes(po.status) &&
    totalOutstanding > 0;

  return (
    <div className="space-y-6">
      {/* Top Bar with Back button and Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/supplier/purchase-orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar PO
        </Link>
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {po.status === "CANCELLED" ? (
            <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-xs text-red-800 font-semibold shadow-2xs">
              <XCircle className="w-4 h-4 text-red-600" />
              <span>Status: Dibatalkan (Cancelled)</span>
            </div>
          ) : !po.supplierAcceptedAt ? (
            <SupplierSignPoModal
              poId={po.id}
              poNumber={po.poNumber}
              defaultSignerName={user.name || po.supplier.contactPerson || ""}
            />
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-800 font-semibold shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>PO Sudah Diterima &amp; Di-TTD</span>
            </div>
          )}

          {isDeliverable && (
            <Link
              href={`/supplier/deliveries/new?po=${po.id}`}
              className="btn btn-primary inline-flex items-center gap-1.5"
            >
              <Truck className="h-4 w-4" />
              + Buat Delivery untuk PO Ini
            </Link>
          )}
        </div>
      </div>

      <PageTitle
        title={po.poNumber}
        subtitle={`Detail pesanan pembelian dan riwayat pengiriman barang`}
        breadcrumb={["Purchase Orders", po.poNumber]}
        action={
          <div className="flex items-center gap-2">
            <Badge color={statusColor(po.status)}>{PO_STATUS_LABEL[po.status] || po.status}</Badge>
          </div>
        }
      />

      {/* Banner Status PO (Dibatalkan atau Konfirmasi Penerimaan & TTD Supplier) */}
      {po.status === "CANCELLED" ? (
        <Card className="p-5 border-2 border-red-200 bg-gradient-to-r from-red-50 to-rose-50/50 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-xs bg-red-100 text-red-700">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-red-900 text-sm sm:text-base">
                  Purchase Order Dibatalkan
                </h3>
                <Badge color="red">DIBATALKAN</Badge>
              </div>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                PO ini telah resmi dibatalkan oleh pihak Purchasing. Mohon untuk tidak memproses penyiapan barang maupun jadwal pengiriman untuk PO ini.
              </p>
              {po.notes && (
                <div className="mt-3 p-3 bg-white/90 border border-red-200/80 rounded-xl text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed shadow-2xs">
                  {po.notes}
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className={`p-5 border-2 ${po.supplierAcceptedAt ? "border-emerald-200/80 bg-gradient-to-r from-emerald-50/50 to-teal-50/30" : "border-amber-200/90 bg-gradient-to-r from-amber-50/60 to-orange-50/30"}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-xs ${po.supplierAcceptedAt ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {po.supplierAcceptedAt ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6 animate-pulse" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {po.supplierAcceptedAt ? "Purchase Order Diterima & Ditandatangani" : "Menunggu Konfirmasi & Tanda Tangan Supplier"}
                  </h3>
                  <Badge color={po.supplierAcceptedAt ? "green" : "amber"}>
                    {po.supplierAcceptedAt ? "Confirmed & Signed" : "Awaiting Acceptance"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {po.supplierAcceptedAt
                    ? `Dikonfirmasi & ditandatangani oleh ${po.supplierAcceptedByName || "Perwakilan Supplier"} pada ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(po.supplierAcceptedAt))}. Tanda tangan ini otomatis tertera pada cetakan dokumen PO resmi.`
                    : "Mohon tinjau rincian barang, kuantitas, dan jadwal pengiriman di bawah, kemudian klik tombol 'Terima & Tanda Tangani PO' untuk memberikan konfirmasi resmi kepada pihak Purchasing."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
              {po.supplierAcceptedAt && po.supplierAcceptedSignature ? (
                <div className="border border-slate-200 bg-white rounded-2xl p-2 shadow-sm text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={po.supplierAcceptedSignature}
                    alt="TTD Supplier"
                    className="h-12 max-w-[140px] object-contain mx-auto"
                  />
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5 truncate max-w-[140px]">
                    {po.supplierAcceptedByName}
                  </span>
                </div>
              ) : (
                <SupplierSignPoModal
                  poId={po.id}
                  poNumber={po.poNumber}
                  defaultSignerName={user.name || po.supplier.contactPerson || ""}
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Informasi Pesanan
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Nomor PO:</dt>
              <dd className="font-semibold text-slate-800 font-mono">{po.poNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tanggal PO:</dt>
              <dd className="font-medium text-slate-700">{formatDateOnly(po.poDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Status PO:</dt>
              <dd>
                <Badge color={statusColor(po.status)}>{po.status}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tujuan & Catatan
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Gudang Tujuan:</dt>
              <dd className="font-semibold text-slate-800 flex items-center gap-1">
                <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                {po.warehouse?.name ?? "Pusat"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Alamat Gudang:</dt>
              <dd className="text-right text-xs text-slate-600 max-w-[180px] truncate">
                {po.warehouse?.address || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Catatan:</dt>
              <dd className="mt-0.5 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 italic">
                {po.notes || "Tidak ada catatan"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ringkasan Kuantitas
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Dipesan:</span>
              <span className="font-bold text-slate-800">{totalOrdered.toLocaleString("id-ID")} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sudah Dikirim:</span>
              <span className="font-medium text-amber-700">{totalDelivered.toLocaleString("id-ID")} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Diterima Gudang:</span>
              <span className="font-medium text-emerald-700">{totalReceived.toLocaleString("id-ID")} kg</span>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between">
              <span className="text-slate-600 font-medium">Sisa Belum Dikirim:</span>
              <span className="font-bold text-blue-700">{totalOutstanding.toLocaleString("id-ID")} kg</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Items Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-blue-600" />
            Daftar Barang dalam PO
          </h3>
          <span className="text-xs text-slate-500">{po.details.length} item</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Item & Konversi</th>
                <th className="px-5 py-3 font-medium text-right">Qty PO</th>
                <th className="px-5 py-3 font-medium text-right">Terkirim</th>
                <th className="px-5 py-3 font-medium text-right">Diterima Gudang</th>
                <th className="px-5 py-3 font-medium text-right">Sisa Kirim</th>
                <th className="px-5 py-3 font-medium text-center">Status Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.details.map((d) => {
                const pkgUnit = d.item.packageUnit || "Kemasan";
                const pkgSize = Number(d.item.packageSize ?? 1);
                const sisaKg = Math.max(0, d.qty - d.deliveredQty);
                const sisaKemasan = pkgSize > 0 ? Math.ceil(sisaKg / pkgSize) : 0;
                const isItemDone = d.receivedQty >= d.qty;

                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{d.item.name}</div>
                      <div className="text-xs text-slate-400">
                        {d.item.code} · 1 {pkgUnit} = {pkgSize} {d.item.unit || "kg"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {d.qty.toLocaleString("id-ID")} {d.item.unit || "kg"}
                    </td>
                    <td className="px-5 py-3 text-right text-amber-700 font-medium">
                      {d.deliveredQty.toLocaleString("id-ID")} {d.item.unit || "kg"}
                    </td>
                    <td className="px-5 py-3 text-right text-emerald-700 font-medium">
                      {d.receivedQty.toLocaleString("id-ID")} {d.item.unit || "kg"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-blue-700">
                      {sisaKg > 0 ? (
                        <>
                          {sisaKg.toLocaleString("id-ID")} {d.item.unit || "kg"}
                          <div className="text-xs font-normal text-slate-400">
                            (≈ {sisaKemasan} {pkgUnit})
                          </div>
                        </>
                      ) : (
                        <span className="text-emerald-600">0 (Lengkap)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {isItemDone ? (
                        <Badge color="green">Selesai</Badge>
                      ) : d.deliveredQty >= d.qty ? (
                        <Badge color="indigo">Menunggu Terima</Badge>
                      ) : d.deliveredQty > 0 ? (
                        <Badge color="purple">Terkirim Sebagian</Badge>
                      ) : (
                        <Badge color="amber">Menunggu Kirim</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Deliveries & Receivings History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deliveries Card */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-blue-600" />
              Riwayat Pengiriman (Surat Jalan)
            </h3>
            <span className="text-xs text-slate-500">{po.deliveries.length} delivery</span>
          </div>

          <div className="divide-y divide-slate-100">
            {po.deliveries.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Belum ada pengiriman untuk PO ini.
              </div>
            ) : (
              po.deliveries.map((dlv) => {
                const totalItemQty = dlv.details.reduce((s, dt) => s + dt.qty, 0);
                const isCancelled = dlv.status === "CANCELLED";

                return (
                  <div
                    key={dlv.id}
                    className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors ${
                      isCancelled ? "bg-slate-50/50 opacity-70" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 text-sm">{dlv.suratJalan}</span>
                        <span className="font-mono text-xs text-slate-400">({dlv.deliveryNumber})</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateOnly(dlv.shipDate)}
                        </span>
                        <span>{dlv.details.length} item ({totalItemQty} kg)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge color={statusColor(dlv.status)}>
                        {DELIVERY_STATUS_LABEL[dlv.status] || dlv.status}
                      </Badge>
                      {!isCancelled && (
                        <Link
                          href={`/supplier/deliveries/${dlv.id}/qr`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          QR
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Receivings Card */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Riwayat Penerimaan Gudang
            </h3>
            <span className="text-xs text-slate-500">{po.receivings.length} penerimaan</span>
          </div>

          <div className="divide-y divide-slate-100">
            {po.receivings.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Belum ada konfirmasi penerimaan barang oleh gudang.
              </div>
            ) : (
              po.receivings.map((rcv) => {
                const totalRcvQty = rcv.details.reduce((s, dt) => s + dt.qtyReceived, 0);

                return (
                  <div
                    key={rcv.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-800">
                          {rcv.receivingNumber}
                        </span>
                        <span className="text-xs text-slate-400">({rcv.warehouse.name})</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateOnly(rcv.receivedAt)}
                        </span>
                        <span>{totalRcvQty.toLocaleString("id-ID")} kg diterima</span>
                      </div>
                    </div>

                    <Badge color={statusColor(rcv.status)}>
                      {RECEIVING_STATUS_LABEL[rcv.status] || rcv.status}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
