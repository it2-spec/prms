import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { PO_STATUS_LABEL, formatDateOnly, formatCompactRupiah, formatMoney } from "@/lib/utils";
import { FileText, Truck, Package, AlertCircle, Wallet, CheckCircle2 } from "lucide-react";
import {
  PurchasingCharts,
  MonthlySpendData,
  PoFulfillmentData,
  TopSupplierData,
} from "@/components/purchasing/PurchasingCharts";

export const dynamic = "force-dynamic";

export default async function PurchasingDashboard() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  // Manager L1 dan Presdir L2 langsung diarahkan ke halaman Purchase Orders
  if (user.approvalLevel === 1 || user.approvalLevel === 2) {
    redirect("/purchasing/purchase-orders");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  // Inisialisasi daftar 6 bulan terakhir (Mei 26, Jun 26, dst.)
  const months: MonthlySpendData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("id-ID", { month: "short" });
    const label = `${monthName} ${String(d.getFullYear()).slice(-2)}`;
    months.push({ key, label, totalAmount: 0, poCount: 0 });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));

  const [totalPO, closedPO, partialPO, deliveriesToday, recentPOs, outstandingItems, allPos] =
    await Promise.all([
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: "CLOSED" } }),
      prisma.purchaseOrder.count({
        where: { status: { in: ["PARTIALLY_DELIVERED", "PARTIALLY_RECEIVED"] } },
      }),
      prisma.delivery.count({ where: { shipDate: { gte: today, lt: tomorrow } } }),
      prisma.purchaseOrder.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { supplier: true },
      }),
      prisma.purchaseOrderDetail.findMany({
        where: { purchaseOrder: { status: { not: "CLOSED" } } },
        include: { purchaseOrder: { include: { supplier: true } }, item: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          poNumber: true,
          poDate: true,
          status: true,
          supplierId: true,
          supplier: {
            select: { id: true, name: true, code: true },
          },
          details: {
            select: {
              qty: true,
              unitPrice: true,
              receivedQty: true,
            },
          },
        },
      }),
    ]);

  const outstandingTotal = outstandingItems.reduce(
    (sum, d) => sum + Math.max(0, d.qty - d.receivedQty),
    0,
  );

  // Agregasi Data Analitik Grafik
  let totalSpendAmount = 0;
  const supplierSpendMap = new Map<
    string,
    { id: string; name: string; code: string; totalAmount: number; poCount: number }
  >();

  let closedCount = 0;
  let closedAmount = 0;
  let partialCount = 0;
  let partialAmount = 0;
  let waitingCount = 0;
  let waitingAmount = 0;
  let draftCount = 0;
  let draftAmount = 0;

  for (const po of allPos) {
    const poAmount = po.details.reduce(
      (sum, d) => sum + Number(d.qty) * Number(d.unitPrice),
      0,
    );
    totalSpendAmount += poAmount;

    // 1. Agregasi Tren Bulanan
    const poD = new Date(po.poDate);
    const poMonthKey = `${poD.getFullYear()}-${String(poD.getMonth() + 1).padStart(2, "0")}`;
    const mData = monthMap.get(poMonthKey);
    if (mData) {
      mData.totalAmount += poAmount;
      mData.poCount += 1;
    }

    // 2. Kategori Status Realisasi
    if (po.status === "CLOSED") {
      closedCount++;
      closedAmount += poAmount;
    } else if (po.status === "PARTIALLY_RECEIVED" || po.status === "PARTIALLY_DELIVERED") {
      partialCount++;
      partialAmount += poAmount;
    } else if (po.status === "DRAFT" || po.status === "REVISED") {
      draftCount++;
      draftAmount += poAmount;
    } else {
      waitingCount++;
      waitingAmount += poAmount;
    }

    // 3. Agregasi Belanja Supplier
    if (po.supplier) {
      const s = supplierSpendMap.get(po.supplierId) || {
        id: po.supplierId,
        name: po.supplier.name,
        code: po.supplier.code,
        totalAmount: 0,
        poCount: 0,
      };
      s.totalAmount += poAmount;
      s.poCount += 1;
      supplierSpendMap.set(po.supplierId, s);
    }
  }

  // Top 5 Supplier Terbesar
  const topSuppliers: TopSupplierData[] = Array.from(supplierSpendMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)
    .map((s) => ({
      ...s,
      sharePercent: totalSpendAmount > 0 ? (s.totalAmount / totalSpendAmount) * 100 : 0,
    }));

  const fulfillmentData: PoFulfillmentData[] = [
    {
      status: "CLOSED",
      label: "Selesai (Closed)",
      count: closedCount,
      totalAmount: closedAmount,
      color: "#10b981",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    },
    {
      status: "PARTIAL",
      label: "Sebagian Diterima",
      count: partialCount,
      totalAmount: partialAmount,
      color: "#f59e0b",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    {
      status: "WAITING",
      label: "Menunggu Supplier / Kirim",
      count: waitingCount,
      totalAmount: waitingAmount,
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      status: "DRAFT",
      label: "Draft Internal",
      count: draftCount,
      totalAmount: draftAmount,
      color: "#94a3b8",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-200",
    },
  ];

  const completionRate = allPos.length > 0 ? Math.round((closedCount / allPos.length) * 100) : 0;
  const avgSpendPerMonth = months.length > 0 ? Math.round(totalSpendAmount / months.length) : 0;

  const stats = [
    { label: "Total PO", value: `${totalPO} PO`, icon: FileText, color: "text-blue-600 bg-blue-50" },
    { label: "Total Belanja", value: formatCompactRupiah(totalSpendAmount), icon: Wallet, color: "text-emerald-600 bg-emerald-50" },
    { label: "Realisasi Closed", value: `${closedPO} PO (${completionRate}%)`, icon: CheckCircle2, color: "text-purple-600 bg-purple-50" },
    { label: "Outstanding Barang", value: `${outstandingTotal} Unit`, icon: AlertCircle, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard Purchasing"
        subtitle="Monitoring Purchase Order dan analitik pengadaan secara realtime"
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

      {/* 3 Grafik Analitik Utama */}
      <PurchasingCharts
        monthlyData={months}
        fulfillmentData={fulfillmentData}
        topSuppliers={topSuppliers}
        summary={{
          totalPoCount: allPos.length,
          totalSpendAmount,
          avgSpendPerMonth,
          completionRate,
        }}
      />

      {/* Tabel PO Terbaru & Outstanding Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">PO Terbaru</h3>
            <p className="text-xs text-slate-500">Delivery Hari Ini: {deliveriesToday} Pengiriman</p>
          </div>
          <div className="divide-y divide-slate-100">
            {recentPOs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Belum ada PO yang dibuat</div>
            ) : (
              recentPOs.map((po) => (
                <Link
                  key={po.id}
                  href={`/purchasing/purchase-orders/${po.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{po.poNumber}</div>
                    <div className="text-xs text-slate-500">{po.supplier.name}</div>
                  </div>
                  <Badge color={statusColor(po.status)}>{PO_STATUS_LABEL[po.status]}</Badge>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">Outstanding Items</h3>
            <p className="text-xs text-slate-500">Item PO yang masih belum diterima lengkap oleh gudang</p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {outstandingItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Tidak ada item outstanding</div>
            ) : (
              outstandingItems.slice(0, 10).map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 pr-3">
                    <div className="truncate text-sm font-medium text-slate-800">{d.item.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {d.purchaseOrder.poNumber} · {d.purchaseOrder.supplier.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-amber-600">
                      {Math.max(0, d.qty - d.receivedQty)} / {d.qty} {d.unit || ""}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatDateOnly(d.purchaseOrder.poDate)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
