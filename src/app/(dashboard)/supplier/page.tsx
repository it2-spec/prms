import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { formatDateOnly } from "@/lib/utils";
import { FileText, Truck, Clock, CheckCircle2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupplierDashboard() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) redirect("/login");

  const supplierId = dbUser.supplierId;

  const [newPOs, undeliveredPOs, closedPOs, deliveries] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { supplierId, status: { in: ["WAITING_DELIVERY", "SENT"] } },
      orderBy: { createdAt: "desc" },
      include: { details: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { supplierId, status: { in: ["WAITING_DELIVERY", "PARTIALLY_DELIVERED"] } },
      orderBy: { createdAt: "desc" },
      include: { details: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { supplierId, status: "CLOSED" },
    }),
    prisma.delivery.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { purchaseOrder: true },
    }),
  ]);

  const stats = [
    { label: "PO Baru", value: newPOs.length, icon: FileText, color: "text-blue-600 bg-blue-50" },
    { label: "PO Belum Dikirim", value: undeliveredPOs.length, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "PO Closed", value: closedPOs.length, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { label: "Total Delivery", value: deliveries.length, icon: Truck, color: "text-indigo-600 bg-indigo-50" },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title="Dashboard Supplier"
        subtitle={dbUser.supplier?.name}
        breadcrumb={["Dashboard"]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">PO Menunggu Pengiriman</h3>
            <Link
              href="/supplier/purchase-orders"
              className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
            >
              Lihat Semua PO <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {newPOs.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada PO baru</div>
            )}
            {newPOs.map((po) => (
              <div key={po.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <Link
                    href={`/supplier/purchase-orders/${po.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {po.poNumber}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {po.details.length} item · {formatDateOnly(po.poDate)}
                  </div>
                </div>
                <Link
                  href={`/supplier/deliveries/new?po=${po.id}`}
                  className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded transition-colors"
                >
                  Kirim →
                </Link>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Delivery History</h3>
            <Link
              href="/supplier/deliveries"
              className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
            >
              Lihat Semua Delivery <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {deliveries.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Belum ada delivery</div>
            )}
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{d.deliveryNumber}</div>
                  <div className="text-xs text-slate-500">
                    {d.purchaseOrder.poNumber} · Surat Jalan: {d.suratJalan}
                  </div>
                </div>
                <Badge color={statusColor(d.status)}>{d.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
