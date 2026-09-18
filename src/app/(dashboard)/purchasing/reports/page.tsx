import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, PageTitle } from "@/components/ui";
import { PO_STATUS_LABEL, formatDateOnly } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const [pos, deliveries, receivings] = await Promise.all([
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: { supplier: true, details: true },
    }),
    prisma.delivery.findMany({
      orderBy: { createdAt: "desc" },
      include: { supplier: true, purchaseOrder: true },
    }),
    prisma.receiving.findMany({
      orderBy: { receivedAt: "desc" },
      include: { warehouse: true, purchaseOrder: true },
    }),
  ]);

  const outstanding = pos.filter((p) => p.status !== "CLOSED");

  return (
    <div className="space-y-4">
      <PageTitle
        title="Laporan"
        subtitle="Ekspor laporan dalam format Excel atau CSV"
        breadcrumb={["Laporan"]}
        action={
          <div className="flex gap-2">
            <a href="/api/export/po?format=excel" className="btn btn-success">
              Export PO Excel
            </a>
            <a href="/api/export/po?format=csv" className="btn btn-primary">
              Export PO CSV
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">Purchase Orders</h3>
            <p className="text-xs text-slate-500">{pos.length} PO</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {pos.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-slate-50 px-5 py-2.5 text-sm">
                <span className="font-medium text-slate-700">{p.poNumber}</span>
                <Badge color={statusColor(p.status)}>{PO_STATUS_LABEL[p.status]}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">Deliveries</h3>
            <p className="text-xs text-slate-500">{deliveries.length} delivery</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b border-slate-50 px-5 py-2.5 text-sm">
                <span className="font-medium text-slate-700">{d.deliveryNumber} · {formatDateOnly(d.shipDate)}</span>
                <span className="text-xs text-slate-400">{d.supplier.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">Receivings</h3>
            <p className="text-xs text-slate-500">{receivings.length} receiving</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {receivings.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-slate-50 px-5 py-2.5 text-sm">
                <span className="font-medium text-slate-700">{r.receivingNumber}</span>
                <span className="text-xs text-slate-400">{r.warehouse.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800">Outstanding PO</h3>
          <p className="text-xs text-slate-500">{outstanding.length} PO belum selesai</p>
        </div>
        <div className="divide-y divide-slate-100">
          {outstanding.map((p) => {
            const tot = p.details.reduce((s, d) => s + d.qty, 0);
            const rec = p.details.reduce((s, d) => s + d.receivedQty, 0);
            return (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{p.poNumber}</span>
                  <span className="ml-2 text-xs text-slate-400">{p.supplier.name}</span>
                </div>
                <div className="font-semibold text-amber-600">
                  Outstanding: {Math.max(0, tot - rec)} / {tot}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
