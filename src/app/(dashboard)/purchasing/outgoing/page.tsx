import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, Badge } from "@/components/ui";
import { History, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PurchasingOutgoingPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/");

  const [outgoingsRaw, warehouses] = await Promise.all([
    prisma.stockOutgoing.findMany({
      orderBy: { issuedAt: "desc" },
      include: {
        warehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
        details: {
          include: {
            item: { select: { code: true, name: true, unit: true, packageUnit: true } },
          },
        },
      },
      take: 200,
    }),
    prisma.warehouse.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const outgoings = outgoingsRaw.flatMap((o) => {
    if (o.details.length === 0) {
      return [
        {
          id: o.id,
          outgoingNumber: o.outgoingNumber,
          issuedAt: o.issuedAt,
          warehouseName: o.warehouse.name,
          purpose: o.purpose,
          department: o.department,
          createdByName: o.createdBy.name,
          status: o.status,
          itemCode: "-",
          itemName: "-",
          packageQty: 0,
          packageUnit: "Kemasan",
        },
      ];
    }
    return o.details.map((dt) => ({
      id: o.id,
      outgoingNumber: o.outgoingNumber,
      issuedAt: o.issuedAt,
      warehouseName: o.warehouse.name,
      purpose: o.purpose,
      department: o.department,
      createdByName: o.createdBy.name,
      status: o.status,
      itemCode: dt.item?.code || "-",
      itemName: dt.item?.name || "-",
      packageQty: dt.packageQty,
      packageUnit: dt.item?.packageUnit || "Kemasan",
    }));
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Riwayat Outgoing Material"
        subtitle="Daftar semua pengeluaran material dari gudang (read-only)"
        breadcrumb={["Purchasing", "Outgoing Material"]}
      />

      <Card>
        {outgoings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <History className="h-10 w-10 opacity-30" />
            <p className="text-sm">Belum ada data outgoing</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-600">No. Transaksi</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tanggal</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Material</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-center">Qty Keluar</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Gudang</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tujuan / Dept</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Dicatat oleh</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {outgoings.map((o, idx) => (
                  <tr
                    key={`${o.id}-${idx}`}
                    className={`border-b border-slate-100 transition ${
                      o.status === "CANCELLED" ? "bg-red-50/20 opacity-75" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          o.status === "CANCELLED" ? "line-through text-slate-400" : "text-violet-700"
                        }`}
                      >
                        {o.outgoingNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(o.issuedAt)}</td>
                    <td className="px-4 py-3 text-xs">
                      {o.status === "CANCELLED" ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                          DIBATALKAN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          SELESAI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-semibold text-xs ${o.status === "CANCELLED" ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {o.itemName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{o.itemCode}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono font-bold text-xs ${o.status === "CANCELLED" ? "line-through text-slate-400" : "text-orange-700"}`}>
                        {o.packageQty} {o.packageUnit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">
                      {o.warehouseName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {o.purpose || o.department ? (
                        <span>
                          {o.purpose || "-"} {o.department ? `(${o.department})` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{o.createdByName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/purchasing/outgoing/${o.id}`}
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
