import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/ui";
import { PackageMinus } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageTitle
          title="Outgoing Material"
          subtitle="Scan barang untuk mencatat pengeluaran stok dari gudang"
          breadcrumb={["Warehouse", "Outgoing Material"]}
        />
        <a
          href="/warehouse/history?tab=outgoing"
          className="btn btn-outline ml-auto inline-flex items-center gap-1 text-sm"
        >
          Riwayat Outgoing
        </a>
      </div>

      <OutgoingPageClient
        warehouses={warehouses}
        initialWarehouseId={defaultWarehouseId}
      />
    </div>
  );
}
