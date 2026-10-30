import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { formatDateOnly, normalizeDepartment } from "@/lib/utils";
import {
  ScanLine,
  Package,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
} from "lucide-react";
import {
  WarehouseCharts,
  MonthlyMutationData,
  FulfillmentCategoryData,
  FastMovingItemData,
  DeptUsageData,
} from "@/components/warehouse/WarehouseCharts";

export const dynamic = "force-dynamic";

export default async function WarehouseDashboard() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const warehouseId = dbUser?.warehouseId;
  const deliveryWhere: any = {
    status: { in: ["CREATED", "SENT"] },
    ...(warehouseId ? { purchaseOrder: { warehouseId } } : {}),
  };
  const receivingWhere: any = {
    ...(warehouseId ? { warehouseId } : {}),
  };
  const outgoingWhere: any = {
    ...(warehouseId ? { warehouseId } : {}),
    status: "COMPLETED",
  };

  // Inisialisasi jendela 6 bulan terakhir
  const months: MonthlyMutationData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("id-ID", { month: "short" });
    const label = `${monthName} ${String(d.getFullYear()).slice(-2)}`;
    months.push({
      key,
      label,
      inBaseQty: 0,
      outBaseQty: 0,
      inPackageQty: 0,
      outPackageQty: 0,
      receivingCount: 0,
      outgoingCount: 0,
    });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));

  const [
    receivingToday,
    outgoingToday,
    pendingScan,
    recentReceivings,
    deliveredNotReceived,
    allReceivings,
    allOutgoings,
    allPos,
  ] = await Promise.all([
    prisma.receiving.count({
      where: {
        ...receivingWhere,
        receivedAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.stockOutgoing.count({
      where: {
        ...outgoingWhere,
        issuedAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.delivery.count({ where: deliveryWhere }),
    prisma.receiving.findMany({
      where: receivingWhere,
      orderBy: { receivedAt: "desc" },
      take: 6,
      include: { purchaseOrder: true, warehouse: true },
    }),
    prisma.delivery.findMany({
      where: deliveryWhere,
      orderBy: { createdAt: "desc" },
      include: { purchaseOrder: { include: { warehouse: true } }, supplier: true },
      take: 6,
    }),
    // Seluruh data Receiving beserta detail item
    prisma.receiving.findMany({
      where: receivingWhere,
      select: {
        id: true,
        receivedAt: true,
        details: {
          select: {
            itemId: true,
            qtyReceived: true,
            item: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                packageUnit: true,
                packageSize: true,
              },
            },
          },
        },
      },
    }),
    // Seluruh data StockOutgoing beserta detail item & departemen
    prisma.stockOutgoing.findMany({
      where: outgoingWhere,
      select: {
        id: true,
        issuedAt: true,
        department: true,
        details: {
          select: {
            itemId: true,
            packageQty: true,
            baseQty: true,
            item: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                packageUnit: true,
              },
            },
          },
        },
      },
    }),
    // Purchase Orders untuk status fulfillment
    prisma.purchaseOrder.findMany({
      where: {
        status: { not: "CANCELLED" },
        ...(warehouseId ? { warehouseId } : {}),
      },
      select: {
        id: true,
        status: true,
      },
    }),
  ]);

  // Agregasi Mutasi IN (Receiving)
  let totalInQty = 0;
  const itemActivityMap = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      unit: string;
      packageUnit?: string | null;
      inBaseQty: number;
      outBaseQty: number;
      outPackageQty: number;
      primaryDepartment?: string | null;
    }
  >();

  for (const r of allReceivings) {
    const rD = new Date(r.receivedAt);
    const rKey = `${rD.getFullYear()}-${String(rD.getMonth() + 1).padStart(2, "0")}`;
    const mData = monthMap.get(rKey);
    if (mData) {
      mData.receivingCount += 1;
    }

    for (const d of r.details) {
      const baseQty = Number(d.qtyReceived) || 0;
      totalInQty += baseQty;

      const pkgSize = Number(d.item?.packageSize) || 1;
      const pkgQty = pkgSize > 0 ? Math.ceil(baseQty / pkgSize) : baseQty;

      if (mData) {
        mData.inBaseQty += baseQty;
        mData.inPackageQty += pkgQty;
      }

      if (d.item) {
        const itemStat = itemActivityMap.get(d.itemId) || {
          id: d.itemId,
          code: d.item.code,
          name: d.item.name,
          unit: d.item.unit || "kg",
          packageUnit: d.item.packageUnit,
          inBaseQty: 0,
          outBaseQty: 0,
          outPackageQty: 0,
        };
        itemStat.inBaseQty += baseQty;
        itemActivityMap.set(d.itemId, itemStat);
      }
    }
  }

  // Agregasi Mutasi OUT (StockOutgoing) & Departemen
  let totalOutQty = 0;
  const deptMap = new Map<string, { department: string; totalQty: number; packageQty: number }>();

  for (const o of allOutgoings) {
    const oD = new Date(o.issuedAt);
    const oKey = `${oD.getFullYear()}-${String(oD.getMonth() + 1).padStart(2, "0")}`;
    const mData = monthMap.get(oKey);
    if (mData) {
      mData.outgoingCount += 1;
    }

    const normDept = normalizeDepartment(o.department);

    for (const d of o.details) {
      const baseQty = Number(d.baseQty) || 0;
      const pkgQty = Number(d.packageQty) || 0;
      totalOutQty += baseQty;

      if (mData) {
        mData.outBaseQty += baseQty;
        mData.outPackageQty += pkgQty;
      }

      // Hitung pemakaian per departemen
      const dStat = deptMap.get(normDept) || {
        department: normDept,
        totalQty: 0,
        packageQty: 0,
      };
      dStat.totalQty += baseQty;
      dStat.packageQty += pkgQty;
      deptMap.set(normDept, dStat);

      if (d.item) {
        const itemStat = itemActivityMap.get(d.itemId) || {
          id: d.itemId,
          code: d.item.code,
          name: d.item.name,
          unit: d.item.unit || "kg",
          packageUnit: d.item.packageUnit,
          inBaseQty: 0,
          outBaseQty: 0,
          outPackageQty: 0,
          primaryDepartment: normDept,
        };
        itemStat.outBaseQty += baseQty;
        itemStat.outPackageQty += pkgQty;
        if (!itemStat.primaryDepartment) itemStat.primaryDepartment = normDept;
        itemActivityMap.set(d.itemId, itemStat);
      }
    }
  }

  // Top 5 Fast Moving Items
  const fastMovingItems: FastMovingItemData[] = Array.from(itemActivityMap.values())
    .sort((a, b) => b.outBaseQty - a.outBaseQty || b.inBaseQty - a.inBaseQty)
    .slice(0, 5);

  // Top Departemen Pemohon
  const totalDeptQty = Array.from(deptMap.values()).reduce((sum, d) => sum + d.totalQty, 0);
  const deptUsage: DeptUsageData[] = Array.from(deptMap.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 5)
    .map((d) => ({
      ...d,
      sharePercent: totalDeptQty > 0 ? (d.totalQty / totalDeptQty) * 100 : 0,
    }));

  // Kategori Fulfillment PO untuk Gudang
  let closedPos = 0;
  let partialPos = 0;
  let waitingPos = 0;
  let draftPos = 0;

  for (const po of allPos) {
    if (po.status === "CLOSED") {
      closedPos++;
    } else if (po.status === "PARTIALLY_RECEIVED" || po.status === "PARTIALLY_DELIVERED") {
      partialPos++;
    } else if (
      po.status === "SENT" ||
      po.status === "WAITING_DELIVERY" ||
      po.status === "WAITING_RECEIVING"
    ) {
      waitingPos++;
    } else {
      draftPos++;
    }
  }

  const fulfillmentCategories: FulfillmentCategoryData[] = [
    {
      status: "CLOSED",
      label: "Lengkap Diterima (Closed)",
      count: closedPos,
      color: "#10b981", // emerald-500
      bgColor: "bg-emerald-50",
    },
    {
      status: "PARTIAL",
      label: "Sebagian Diterima",
      count: partialPos,
      color: "#f59e0b", // amber-500
      bgColor: "bg-amber-50",
    },
    {
      status: "WAITING",
      label: "Sedang Dikirim Supplier",
      count: waitingPos,
      color: "#3b82f6", // blue-500
      bgColor: "bg-blue-50",
    },
    {
      status: "PENDING",
      label: "Belum Dikirim (Draft / Open)",
      count: draftPos,
      color: "#94a3b8", // slate-400
      bgColor: "bg-slate-50",
    },
  ];

  const fulfillmentRate =
    allPos.length > 0 ? Math.round((closedPos / allPos.length) * 100) : 0;

  const stats = [
    {
      label: "Receiving Hari Ini",
      value: `${receivingToday} Dokumen`,
      icon: ArrowDownToLine,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Outgoing Hari Ini",
      value: `${outgoingToday} Dokumen`,
      icon: ArrowUpFromLine,
      color: "text-rose-600 bg-rose-50",
    },
    {
      label: "Delivery Menunggu Scan",
      value: `${pendingScan} Surat Jalan`,
      icon: ScanLine,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "PO Lengkap Diterima",
      value: `${closedPos} PO (${fulfillmentRate}%)`,
      icon: CheckCircle2,
      color: "text-blue-600 bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard Warehouse & Material Control"
        subtitle={
          dbUser?.warehouse?.name
            ? `Monitoring mutasi material & receiving: ${dbUser.warehouse.name}`
            : "Monitoring mutasi material & receiving gudang secara realtime"
        }
        breadcrumb={["Dashboard"]}
      />

      {/* KPI Cards Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} bodyClassName="!p-5">
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-extrabold text-slate-800">{s.value}</div>
                <div className="truncate text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 4 Grafik Analitik Warehouse & Material Control */}
      <WarehouseCharts
        monthlyMutations={months}
        fulfillmentCategories={fulfillmentCategories}
        fastMovingItems={fastMovingItems}
        deptUsage={deptUsage}
        summary={{
          totalInQty,
          totalOutQty,
          netQty: totalInQty - totalOutQty,
          totalPos: allPos.length,
          closedPos,
          fulfillmentRate,
        }}
      />

      {/* Tabel Delivery Menunggu Scan & Recent Receiving */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Delivery Menunggu Scan</h3>
              <p className="text-xs text-slate-500">Surat Jalan yang telah dikirimkan oleh supplier</p>
            </div>
            <Link
              href="/warehouse/scan"
              className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Scan QR
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {deliveredNotReceived.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Tidak ada delivery menunggu scan
              </div>
            ) : (
              deliveredNotReceived.map((d) => (
                <Link
                  key={d.id}
                  href={`/warehouse/scan/result?delivery=${encodeURIComponent(d.deliveryNumber)}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{d.deliveryNumber}</span>
                      {d.purchaseOrder.warehouse?.name && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {d.purchaseOrder.warehouse.name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {d.purchaseOrder.poNumber} · {d.supplier.name}
                    </div>
                  </div>
                  <Badge color={statusColor(d.status)}>{d.status}</Badge>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Recent Receiving</h3>
              <p className="text-xs text-slate-500">Penerimaan barang terbaru di dock gudang</p>
            </div>
            <Link
              href="/warehouse/receivings"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Lihat Semua
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentReceivings.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Belum ada receiving yang tercatat
              </div>
            ) : (
              recentReceivings.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{r.receivingNumber}</div>
                    <div className="text-xs text-slate-500">
                      {r.purchaseOrder.poNumber} · {r.warehouse.name}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {formatDateOnly(r.receivedAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
