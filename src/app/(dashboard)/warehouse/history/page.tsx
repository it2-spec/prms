import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { PackagePlus, PackageMinus, QrCode } from "lucide-react";
import HistoryTabsClient from "./HistoryTabsClient";

export const dynamic = "force-dynamic";

export default async function WarehouseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  const params = await searchParams;
  const initialTab = params.tab === "outgoing" ? "outgoing" : "receiving";

  const warehouseId = dbUser?.warehouseId;
  const whereClause = warehouseId ? { warehouseId } : {};

  const [receivingsRaw, outgoingsRaw] = await Promise.all([
    prisma.receiving.findMany({
      where: whereClause,
      orderBy: { receivedAt: "desc" },
      include: {
        purchaseOrder: { include: { supplier: true } },
        delivery: true,
        warehouse: true,
        details: true,
      },
      take: 100,
    }),
    prisma.stockOutgoing.findMany({
      where: whereClause,
      orderBy: { issuedAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        details: {
          include: {
            item: {
              select: {
                code: true,
                name: true,
                unit: true,
                packageUnit: true,
              },
            },
          },
        },
      },
      take: 200,
    }),
  ]);

  const receivings = receivingsRaw.map((r) => ({
    id: r.id,
    receivingNumber: r.receivingNumber,
    deliveryNumber: r.delivery.deliveryNumber,
    poNumber: r.purchaseOrder.poNumber,
    supplierName: r.purchaseOrder.supplier.name,
    warehouseName: r.warehouse.name,
    receivedAt: r.receivedAt.toISOString(),
    isManual: r.isManual,
    status: r.status,
    itemCount: r.details.length,
  }));

  const outgoings = outgoingsRaw.flatMap((o) => {
    if (o.details.length === 0) {
      return [
        {
          id: o.id,
          outgoingNumber: o.outgoingNumber,
          issuedAt: o.issuedAt.toISOString(),
          itemCode: "-",
          itemName: "-",
          packageQty: 0,
          packageUnit: "Kemasan",
          baseQty: 0,
          unit: "kg",
          purpose: o.purpose,
          department: o.department,
          createdByName: o.createdBy.name,
          status: o.status,
          cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
          cancelReason: o.cancelReason,
        },
      ];
    }
    return o.details.map((dt) => ({
      id: o.id,
      outgoingNumber: o.outgoingNumber,
      issuedAt: o.issuedAt.toISOString(),
      itemCode: dt.item?.code || "-",
      itemName: dt.item?.name || "-",
      packageQty: dt.packageQty,
      packageUnit: dt.item?.packageUnit || "Kemasan",
      baseQty: Number(dt.baseQty),
      unit: dt.item?.unit || "kg",
      purpose: o.purpose,
      department: o.department,
      createdByName: o.createdBy.name,
      status: o.status,
      cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
      cancelReason: o.cancelReason,
    }));
  });

  return (
    <div className="space-y-5">
      {/* Header Halaman */}
      <PageTitle
        title="Riwayat Transaksi Gudang"
        subtitle={
          dbUser?.warehouse
            ? `Arsip mutasi penerimaan & pengeluaran di ${dbUser.warehouse.name}`
            : "Arsip lengkap mutasi penerimaan dan pengeluaran barang gudang"
        }
        breadcrumb={["Warehouse", "Riwayat Transaksi"]}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/warehouse/scan"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              Scan Masuk
            </Link>
            <Link
              href="/warehouse/outgoing"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              <PackageMinus className="w-3.5 h-3.5" />
              Outgoing Baru
            </Link>
          </div>
        }
      />

      {/* Komponen Tab Terpadu (Masuk & Keluar) */}
      <HistoryTabsClient
        initialTab={initialTab}
        receivings={receivings}
        outgoings={outgoings}
        warehouseName={dbUser?.warehouse?.name}
      />
    </div>
  );
}
