import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { formatDateOnly } from "@/lib/utils";
import { ScanLine, Package, Clock } from "lucide-react";

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

  const [receivingToday, pendingScan, recentReceivings, deliveredNotReceived] = await Promise.all([
    prisma.receiving.count({
      where: {
        ...receivingWhere,
        receivedAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.delivery.count({ where: deliveryWhere }),
    prisma.receiving.findMany({
      where: receivingWhere,
      orderBy: { receivedAt: "desc" },
      take: 5,
      include: { purchaseOrder: true, warehouse: true },
    }),
    prisma.delivery.findMany({
      where: deliveryWhere,
      orderBy: { createdAt: "desc" },
      include: { purchaseOrder: { include: { warehouse: true } }, supplier: true },
      take: 10,
    }),
  ]);

  const stats = [
    { label: "Receiving Today", value: receivingToday, icon: Package, color: "text-emerald-600 bg-emerald-50" },
    { label: "Pending Scan", value: pendingScan, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Manual Input", value: 0, icon: ScanLine, color: "text-blue-600 bg-blue-50" },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title="Dashboard Warehouse"
        subtitle={dbUser?.warehouse?.name}
        breadcrumb={["Dashboard"]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            <h3 className="text-sm font-semibold text-slate-800">Delivery Menunggu Scan</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {deliveredNotReceived.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada delivery menunggu</div>
            )}
            {deliveredNotReceived.map((d) => (
              <Link
                key={d.id}
                href={`/warehouse/scan/result?delivery=${encodeURIComponent(d.deliveryNumber)}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{d.deliveryNumber}</span>
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
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">Recent Receiving</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {recentReceivings.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Belum ada receiving</div>
            )}
            {recentReceivings.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{r.receivingNumber}</div>
                  <div className="text-xs text-slate-500">
                    {r.purchaseOrder.poNumber} · {r.warehouse.name}
                  </div>
                </div>
                <span className="text-xs text-slate-400">{formatDateOnly(r.receivedAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
