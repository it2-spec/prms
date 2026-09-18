import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { formatDateOnly } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import ReceivingForm from "./ReceivingForm";

export const dynamic = "force-dynamic";

export default async function ScanResultPage({
  searchParams,
}: {
  searchParams: Promise<{ delivery?: string }>;
}) {
  const params = await searchParams;
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  const deliveryNumber = params.delivery?.trim();
  if (!deliveryNumber) redirect("/warehouse/scan");

  const delivery = await prisma.delivery.findUnique({
    where: { deliveryNumber },
    include: {
      purchaseOrder: { include: { supplier: true, warehouse: true } },
      supplier: true,
      details: {
        include: { item: true, purchaseOrderDetail: true },
      },
      receivings: true,
    },
  });

  if (!delivery) notFound();

  const isWrongWarehouse = Boolean(
    delivery.purchaseOrder.warehouseId &&
    dbUser?.warehouseId &&
    delivery.purchaseOrder.warehouseId !== dbUser.warehouseId
  );

  const serializedDelivery = {
    id: delivery.id,
    deliveryNumber: delivery.deliveryNumber,
    status: delivery.status,
    details: delivery.details.map((d) => ({
      id: d.id,
      qty: d.qty,
      unitPrice: Number(d.unitPrice),
      item: {
        id: d.item.id,
        name: d.item.name,
        code: d.item.code,
        unit: d.item.unit,
        packageUnit: d.item.packageUnit,
        packageSize: d.item.packageSize ? Number(d.item.packageSize) : null,
      },
      purchaseOrderDetail: {
        qty: d.purchaseOrderDetail.qty,
        receivedQty: d.purchaseOrderDetail.receivedQty,
        unitPrice: Number(d.purchaseOrderDetail.unitPrice),
      },
    })),
  };

  const hasPendingReceiving = delivery.receivings.some((r) => r.status === "PENDING");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle
        title={delivery.deliveryNumber}
        subtitle="Scan berhasil — verifikasi fisik barang (FR-05, FR-06)"
        breadcrumb={["Scan QR", "Result"]}
        action={<Badge color={statusColor(delivery.status)}>{delivery.status}</Badge>}
      />

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Purchase Order</dt>
            <dd className="font-medium text-slate-800">{delivery.purchaseOrder.poNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Supplier</dt>
            <dd className="font-medium text-slate-800">{delivery.supplier.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Gudang Tujuan (Plant)</dt>
            <dd className="font-medium text-slate-800">
              {delivery.purchaseOrder.warehouse?.name ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  isWrongWarehouse ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {delivery.purchaseOrder.warehouse.name}
                </span>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Surat Jalan</dt>
            <dd className="font-medium text-slate-800">{delivery.suratJalan}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Tanggal Kirim</dt>
            <dd className="font-medium text-slate-800">{formatDateOnly(delivery.shipDate)}</dd>
          </div>
        </dl>
      </Card>

      {isWrongWarehouse ? (
        <Card className="border-amber-200 bg-amber-50/70 p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900">Beda Lokasi / Plant Gudang</h3>
            <p className="mt-1 text-sm text-amber-800">
              Pengiriman ini ditujukan untuk <strong>{delivery.purchaseOrder.warehouse?.name || "Plant Lain"}</strong>.
              <br />
              Akun Anda terdaftar di <strong>{dbUser?.warehouse?.name || "Plant Berbeda"}</strong>.
              <br />
              Fisik barang hanya dapat diverifikasi & diterima oleh petugas di plant/gudang tujuan yang sesuai.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/warehouse/scan" className="btn btn-secondary">
              ← Kembali ke Scanner
            </Link>
            <Link href="/warehouse" className="btn btn-dark">
              Dashboard Warehouse
            </Link>
          </div>
        </Card>
      ) : delivery.status === "CANCELLED" ? (
        <Card className="border-red-200 bg-red-50 p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-red-800">Surat Jalan Telah Dibatalkan</h3>
            <p className="mt-1 text-sm text-red-600">
              Pengiriman dengan nomor surat jalan <strong>{delivery.suratJalan}</strong> ini telah
              dibatalkan oleh supplier. Fisik barang tidak dapat diproses penerimaannya di gudang.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/warehouse/scan" className="btn btn-secondary">
              ← Kembali ke Scanner
            </Link>
          </div>
        </Card>
      ) : hasPendingReceiving ? (
        <Card>
          <div className="alert alert-warning py-2 text-sm" role="alert">
            Delivery ini sudah memiliki receiving yang belum dikonfirmasi. Cek riwayat receiving.
          </div>
          <div className="mt-4">
            <Link href="/warehouse/receivings" className="text-sm font-medium text-blue-600 hover:underline">
              Lihat Riwayat Receiving →
            </Link>
          </div>
        </Card>
      ) : (
        <ReceivingForm delivery={serializedDelivery as any} warehouseId={dbUser?.warehouseId ?? ""} />
      )}
    </div>
  );
}
