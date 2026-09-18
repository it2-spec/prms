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

  const warehouseId = dbUser?.warehouseId;
  if (!warehouseId) {
    return (
      <div className="alert alert-warning">
        Akun Anda tidak terhubung ke gudang manapun. Hubungi administrator.
      </div>
    );
  }

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { name: true },
  });

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
        warehouseId={warehouseId}
        warehouseName={warehouse?.name ?? "Gudang"}
      />
    </div>
  );
}
