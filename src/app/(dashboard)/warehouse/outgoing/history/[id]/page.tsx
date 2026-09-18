import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card } from "@/components/ui";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";
import CancelOutgoingButton from "./CancelOutgoingButton";

export const dynamic = "force-dynamic";

export default async function OutgoingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/");

  const { id } = await params;

  const outgoing = await prisma.stockOutgoing.findUnique({
    where: { id },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      details: {
        include: {
          item: { select: { code: true, name: true, unit: true, packageUnit: true, packageSize: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!outgoing) notFound();

  // Pastikan outgoing ini milik gudang user yang login
  if (dbUser?.warehouseId && outgoing.warehouseId !== dbUser.warehouseId) {
    redirect("/warehouse/history?tab=outgoing");
  }

  const isCancelled = outgoing.status === "CANCELLED";
  const totalPackageQty = outgoing.details.reduce((acc, dt) => acc + dt.packageQty, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/warehouse/history?tab=outgoing"
            className="btn btn-outline inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <PageTitle
            title={`Outgoing: ${outgoing.outgoingNumber}`}
            subtitle={formatDate(outgoing.issuedAt)}
            breadcrumb={["Warehouse", "Riwayat Outgoing", outgoing.outgoingNumber]}
          />
        </div>

        {/* Action Button: Batalkan */}
        {!isCancelled && (
          <div>
            <CancelOutgoingButton
              outgoingId={outgoing.id}
              outgoingNumber={outgoing.outgoingNumber}
              totalQty={totalPackageQty}
            />
          </div>
        )}
      </div>

      {/* Banner Jika Transaksi Telah Dibatalkan */}
      {isCancelled && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-900 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm text-red-800">
              Transaksi Ini Telah DIBATALKAN
              {outgoing.cancelledAt && ` pada ${formatDate(outgoing.cancelledAt)}`}
            </div>
            <p className="text-xs text-red-700">
              Alasan: <strong>{outgoing.cancelReason || "Dibatalkan petugas"}</strong>
            </p>
            <p className="text-xs text-emerald-700 font-semibold mt-1">
              ✓ Seluruh item pada transaksi ini tidak mengurangi stok gudang (sudah kembali ke saldo gudang).
            </p>
          </div>
        </div>
      )}

      {/* Info header */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">No. Transaksi</p>
            <p className={`font-mono text-sm font-bold ${isCancelled ? "line-through text-slate-400" : "text-violet-700"}`}>
              {outgoing.outgoingNumber}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status Transaksi</p>
            <div className="mt-0.5">
              {isCancelled ? (
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-xs">
                  DIBATALKAN
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                  SELESAI (COMPLETED)
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Gudang</p>
            <p className="text-sm font-semibold text-slate-800">{outgoing.warehouse.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tujuan Pemakaian</p>
            <p className="text-sm font-semibold text-slate-800">{outgoing.purpose ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Departemen</p>
            <p className="text-sm font-semibold text-slate-800">{outgoing.department ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dicatat oleh</p>
            <p className="text-sm text-slate-700">{outgoing.createdBy.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tanggal Keluar</p>
            <p className="text-sm text-slate-700">{formatDate(outgoing.issuedAt)}</p>
          </div>
        </div>
      </Card>

      {/* Detail item */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Detail Item</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-600">No</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Kode</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Nama Material</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">Qty Keluar</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">Satuan Dasar</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {outgoing.details.map((d, i) => {
                const pkgSize = Number(d.item.packageSize ?? 1);
                return (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-violet-700">{d.item.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{d.item.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-slate-800">{d.packageQty}</span>{" "}
                      <span className="text-xs text-slate-500">{d.item.packageUnit}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-700">
                        {(d.packageQty * pkgSize).toFixed(2)}
                      </span>{" "}
                      <span className="text-xs text-slate-500">{d.item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{d.notes ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
