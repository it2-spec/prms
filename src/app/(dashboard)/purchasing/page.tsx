import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { PO_STATUS_LABEL, formatDateOnly } from "@/lib/utils";
import { FileText, Truck, Package, AlertCircle } from "lucide-react";

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

  const [totalPO, closedPO, partialPO, deliveriesToday, recentPOs, outstandingItems] =
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
    ]);

  const outstandingTotal = outstandingItems.reduce(
    (sum, d) => sum + Math.max(0, d.qty - d.receivedQty),
    0,
  );

  const stats = [
    { label: "Total PO", value: totalPO, icon: FileText, color: "text-blue-600 bg-blue-50" },
    { label: "Outstanding", value: outstandingTotal, icon: AlertCircle, color: "text-amber-600 bg-amber-50" },
    { label: "Closed", value: closedPO, icon: Package, color: "text-emerald-600 bg-emerald-50" },
    { label: "Partial", value: partialPO, icon: Truck, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title="Dashboard Purchasing"
        subtitle="Monitoring Purchase Order secara realtime"
        breadcrumb={["Dashboard"]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} bodyClassName="!p-5">
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">PO Terbaru</h3>
            <p className="text-xs text-slate-500">Delivery Today: {deliveriesToday}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {recentPOs.map((po) => (
              <Link
                key={po.id}
                href={`/purchasing/purchase-orders/${po.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">{po.poNumber}</div>
                  <div className="text-xs text-slate-500">{po.supplier.name}</div>
                </div>
                <Badge color={statusColor(po.status)}>{PO_STATUS_LABEL[po.status]}</Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">Outstanding Items</h3>
            <p className="text-xs text-slate-500">Item yang belum diterima penuh</p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {outstandingItems.slice(0, 10).map((d) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{d.item.name}</div>
                  <div className="text-xs text-slate-500">
                    {d.purchaseOrder.poNumber} · {d.purchaseOrder.supplier.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-amber-600">
                    {Math.max(0, d.qty - d.receivedQty)} / {d.qty}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatDateOnly(d.purchaseOrder.poDate)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
