import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, Badge } from "@/components/ui";
import { History, PackageMinus, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OutgoingHistoryPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/");

  const warehouseId = dbUser?.warehouseId;
  if (!warehouseId) {
    return (
      <div className="alert alert-warning">
        Akun Anda tidak terhubung ke gudang manapun.
      </div>
    );
  }

  const outgoings = await prisma.stockOutgoing.findMany({
    where: { warehouseId },
    orderBy: { issuedAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      details: {
        include: {
          item: { select: { code: true, name: true, packageUnit: true } },
        },
      },
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageTitle
          title="Riwayat Outgoing"
          subtitle="Daftar pengeluaran material dari gudang"
          breadcrumb={["Warehouse", "Outgoing Material", "Riwayat"]}
        />
        <Link
          href="/warehouse/outgoing"
          className="btn btn-primary ml-auto inline-flex items-center gap-1 text-sm"
        >
          <PackageMinus className="h-4 w-4" />
          Outgoing Baru
        </Link>
      </div>

      <Card>
        {outgoings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <PackageMinus className="h-10 w-10 opacity-30" />
            <p className="text-sm">Belum ada transaksi outgoing</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-600">No. Transaksi</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tanggal</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tujuan Pemakaian</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Departemen</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Jumlah Item</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Dicatat oleh</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {outgoings.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-violet-700">
                        {o.outgoingNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(o.issuedAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{o.purpose ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{o.department ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Badge color="violet">{o.details.length} item</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{o.createdBy.name}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/warehouse/outgoing/history/${o.id}`}
                        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                      >
                        Detail <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
