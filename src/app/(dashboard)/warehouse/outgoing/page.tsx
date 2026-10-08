import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/ui";
import { History } from "lucide-react";
import OutgoingPageClient from "./OutgoingPageClient";

export const dynamic = "force-dynamic";

export default async function OutgoingPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/");

  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  if (warehouses.length === 0) {
    return (
      <div className="alert alert-warning">
        Belum ada data gudang aktif di sistem. Hubungi administrator.
      </div>
    );
  }

  const defaultWarehouseId = dbUser?.warehouseId || warehouses[0].id;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle
        title="Outgoing Material"
        subtitle="Scan barang untuk mencatat pengeluaran stok dari gudang"
        breadcrumb={["Warehouse", "Outgoing Material"]}
        action={
          <Link
            href="/warehouse/history?tab=outgoing"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Riwayat Outgoing</span>
          </Link>
        }
      />

      <OutgoingPageClient
        warehouses={warehouses}
        initialWarehouseId={defaultWarehouseId}
      />
    </div>
  );
}
