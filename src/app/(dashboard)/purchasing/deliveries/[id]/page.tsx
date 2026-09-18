import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle, Button } from "@/components/ui";
import { DELIVERY_STATUS_LABEL, formatDateOnly } from "@/lib/utils";
import { ArrowLeft, Building2, Calendar, FileText, Package, QrCode, Truck, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      supplier: true,
      purchaseOrder: true,
      createdBy: true,
      details: {
        include: {
          item: true,
          purchaseOrderDetail: true,
        },
      },
      receivings: {
        include: {
          warehouse: true,
          receivedBy: true,
          details: { include: { item: true } },
        },
      },
    },
  });

  if (!delivery) {
    redirect("/purchasing/deliveries");
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Detail Delivery — ${delivery.deliveryNumber}`}
        subtitle={`Surat Jalan: ${delivery.suratJalan}`}
        breadcrumb={["Deliveries", delivery.deliveryNumber]}
        action={
          <div className="flex gap-2">
            <Link href={user.role === "SUPPLIER" ? "/supplier/deliveries" : "/purchasing/deliveries"}>
              <Button variant="secondary" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Kembali
              </Button>
            </Link>
            {user.role === "SUPPLIER" && (
              <Link href={`/supplier/deliveries/${delivery.id}/qr`}>
                <Button variant="primary" className="gap-2">
                  <QrCode className="w-4 h-4" /> QR Code Surat Jalan
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-primary" /> Pengiriman
          </div>
          <div>
            <p className="text-xs text-slate-400">Nomor Delivery</p>
            <p className="font-mono font-bold text-slate-800">{delivery.deliveryNumber}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Nomor Surat Jalan</p>
            <p className="font-semibold text-slate-700">{delivery.suratJalan}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Status Pengiriman</p>
            <Badge color={statusColor(delivery.status)}>
              {DELIVERY_STATUS_LABEL[delivery.status]}
            </Badge>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-primary" /> Supplier & PO
          </div>
          <div>
            <p className="text-xs text-slate-400">Supplier</p>
            <p className="font-semibold text-slate-800">{delivery.supplier.name}</p>
            <p className="text-xs text-slate-500">{delivery.supplier.code}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Nomor PO</p>
            <Link
              href={`/purchasing/purchase-orders/${delivery.purchaseOrderId}`}
              className="font-mono font-semibold text-blue-600 hover:underline"
            >
              {delivery.purchaseOrder.poNumber}
            </Link>
          </div>
          <div>
            <p className="text-xs text-slate-400">Dibuat Oleh</p>
            <p className="text-xs font-medium text-slate-700">{delivery.createdBy.name}</p>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-primary" /> Tanggal & Waktu
          </div>
          <div>
            <p className="text-xs text-slate-400">Tanggal Pengiriman (Ship Date)</p>
            <p className="font-semibold text-slate-800">{formatDateOnly(delivery.shipDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Dibuat Pada</p>
            <p className="text-xs font-medium text-slate-700">
              {new Date(delivery.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </Card>
      </div>

      {/* Tabel Item Pengiriman */}
      <Card className="p-5">
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Rincian Item Dikirim ({delivery.details.length} Item)
        </h3>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Nama Item</th>
                <th className="px-4 py-3 text-center">Spesifikasi Kemasan</th>
                <th className="px-4 py-3 text-right">Jumlah Dikirim (Kemasan)</th>
                <th className="px-4 py-3 text-right">Total Berat (Kg)</th>
                <th className="px-4 py-3 text-right">Harga Satuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {delivery.details.map((d, idx) => {
                const pkgSize = Number(d.item.packageSize ?? 1);
                const pkgUnit = d.item.packageUnit || "Pail";
                const pkgQty = pkgSize > 0 ? Math.floor(d.qty / pkgSize) : d.qty;

                return (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {d.item.name}
                      <div className="text-xs text-slate-400 font-mono">{d.item.code}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-700">
                        1 {pkgUnit} = {pkgSize} {d.item.unit || "kg"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {pkgQty} {pkgUnit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {d.qty} {d.item.unit || "kg"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 text-xs">
                      Rp {Number(d.unitPrice).toLocaleString("id-ID")}/{d.item.unit || "kg"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Status Penerimaan Barang (Receivings Linked) */}
      <Card className="p-5">
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-600" /> Riwayat Penerimaan Gudang ({delivery.receivings.length})
        </h3>

        {delivery.receivings.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Barang belum diterima oleh gudang.</p>
        ) : (
          <div className="space-y-3">
            {delivery.receivings.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">{r.receivingNumber}</span>
                    <Badge color={statusColor(r.status)}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Gudang: <strong>{r.warehouse.name}</strong> · Diterima oleh: <strong>{r.receivedBy.name}</strong> pada {formatDateOnly(r.receivedAt)}
                  </p>
                </div>
                <Link href={`/purchasing/receivings/${r.id}`}>
                  <Button variant="secondary" className="text-xs">Lihat Detail Receiving</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
