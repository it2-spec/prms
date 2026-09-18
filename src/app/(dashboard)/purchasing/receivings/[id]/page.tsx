import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle, Button } from "@/components/ui";
import { RECEIVING_STATUS_LABEL, formatDateOnly } from "@/lib/utils";
import { ArrowLeft, Building2, Calendar, CheckCircle2, FileText, Package, Truck, User, Warehouse } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReceivingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const receiving = await prisma.receiving.findUnique({
    where: { id },
    include: {
      purchaseOrder: { include: { supplier: true } },
      delivery: { include: { supplier: true } },
      warehouse: true,
      receivedBy: true,
      details: {
        include: {
          item: true,
          deliveryDetail: true,
        },
      },
    },
  });

  if (!receiving) {
    redirect("/purchasing/receivings");
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Detail Receiving — ${receiving.receivingNumber}`}
        subtitle={`Nomor Surat Jalan: ${receiving.delivery.suratJalan}`}
        breadcrumb={["Receivings", receiving.receivingNumber]}
        action={
          <Link href={user.role === "WAREHOUSE" ? "/warehouse/receivings" : "/purchasing/receivings"}>
            <Button variant="secondary" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Kembali
            </Button>
          </Link>
        }
      />

      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Informasi Receiving
          </div>
          <div>
            <p className="text-xs text-slate-400">Nomor Receiving</p>
            <p className="font-mono font-bold text-slate-800">{receiving.receivingNumber}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Metode Penerimaan</p>
            <Badge color={receiving.isManual ? "amber" : "green"}>
              {receiving.isManual ? "Manual (QR Rusak)" : "Scan QR Code"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-slate-400">Status</p>
            <Badge color={statusColor(receiving.status)}>
              {RECEIVING_STATUS_LABEL[receiving.status]}
            </Badge>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Warehouse className="w-4 h-4 text-primary" /> Lokasi & Penerima
          </div>
          <div>
            <p className="text-xs text-slate-400">Gudang Penerima</p>
            <p className="font-semibold text-slate-800">{receiving.warehouse.name}</p>
            <p className="text-xs text-slate-500">{receiving.warehouse.code}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Petugas Gudang (Received By)</p>
            <p className="text-xs font-semibold text-slate-700">{receiving.receivedBy.name}</p>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-primary" /> Pengiriman & PO
          </div>
          <div>
            <p className="text-xs text-slate-400">Supplier</p>
            <p className="font-semibold text-slate-800">{receiving.delivery.supplier.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Nomor Surat Jalan / Delivery</p>
            <Link
              href={`/purchasing/deliveries/${receiving.delivery.id}`}
              className="font-mono text-xs font-semibold text-blue-600 hover:underline"
            >
              {receiving.delivery.suratJalan} ({receiving.delivery.deliveryNumber})
            </Link>
          </div>
          <div>
            <p className="text-xs text-slate-400">Nomor PO</p>
            <Link
              href={`/purchasing/purchase-orders/${receiving.purchaseOrderId}`}
              className="font-mono text-xs font-semibold text-blue-600 hover:underline"
            >
              {receiving.purchaseOrder.poNumber}
            </Link>
          </div>
        </Card>
      </div>

      {/* Rincian Item Diterima */}
      <Card className="p-5">
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Detail Barang Diterima ({receiving.details.length} Item)
        </h3>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Nama Item</th>
                <th className="px-4 py-3 text-center">Spesifikasi Kemasan</th>
                <th className="px-4 py-3 text-right">Dikirim (Kemasan)</th>
                <th className="px-4 py-3 text-right">Diterima (Kemasan)</th>
                <th className="px-4 py-3 text-right font-bold text-emerald-700">Total Berat Diterima (Kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receiving.details.map((d, idx) => {
                const pkgSize = Number(d.item.packageSize ?? 1);
                const pkgUnit = d.item.packageUnit || "Pail";
                const pkgDelivered = pkgSize > 0 ? Math.floor(d.qtyDelivered / pkgSize) : d.qtyDelivered;
                const pkgReceived = pkgSize > 0 ? Math.floor(d.qtyReceived / pkgSize) : d.qtyReceived;

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
                    <td className="px-4 py-3 text-right text-slate-600">
                      {pkgDelivered} {pkgUnit} ({d.qtyDelivered} {d.item.unit || "kg"})
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {pkgReceived} {pkgUnit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                      {d.qtyReceived} {d.item.unit || "kg"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
