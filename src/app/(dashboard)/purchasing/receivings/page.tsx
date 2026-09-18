import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, statusColor, EmptyState, PageTitle } from "@/components/ui";
import { RECEIVING_STATUS_LABEL, formatDateOnly } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReceivingsPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const receivings = await prisma.receiving.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      purchaseOrder: true,
      delivery: true,
      warehouse: true,
      receivedBy: true,
      details: true,
    },
  });

  return (
    <div className="space-y-4">
      <PageTitle
        title="Receivings"
        subtitle="Histori penerimaan barang"
        breadcrumb={["Receivings"]}
      />

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Receiving</th>
              <th className="px-5 py-3 font-medium">PO</th>
              <th className="px-5 py-3 font-medium">Delivery</th>
              <th className="px-5 py-3 font-medium">Warehouse</th>
              <th className="px-5 py-3 font-medium">Diterima Oleh</th>
              <th className="px-5 py-3 font-medium">Tanggal</th>
              <th className="px-5 py-3 font-medium">Items</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receivings.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">
                  <Link href={`/purchasing/receivings/${r.id}`} className="text-blue-600 font-mono hover:underline">
                    {r.receivingNumber}
                  </Link>
                </td>
                <td className="px-5 py-3">{r.purchaseOrder.poNumber}</td>
                <td className="px-5 py-3">
                  <Link href={`/purchasing/deliveries/${r.deliveryId}`} className="text-slate-700 hover:underline font-mono">
                    {r.delivery.deliveryNumber}
                  </Link>
                </td>
                <td className="px-5 py-3">{r.warehouse.name}</td>
                <td className="px-5 py-3">{r.receivedBy.name}</td>
                <td className="px-5 py-3 text-slate-500">{formatDateOnly(r.receivedAt)}</td>
                <td className="px-5 py-3">{r.details.length}</td>
                <td className="px-5 py-3">
                  <Badge color={statusColor(r.status)}>{RECEIVING_STATUS_LABEL[r.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {receivings.length === 0 && <EmptyState message="Belum ada receiving." />}
      </Card>
    </div>
  );
}
