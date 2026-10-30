import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import MaterialStockView from "@/components/stock/MaterialStockView";

export const dynamic = "force-dynamic";

export default async function WarehouseStockPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  const whereWh: any = { isActive: true };
  if (dbUser?.warehouseId) {
    whereWh.id = dbUser.warehouseId;
  }

  const warehouses = await prisma.warehouse.findMany({
    where: whereWh,
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <MaterialStockView
      warehouses={warehouses}
      initialWarehouseId={dbUser?.warehouseId || warehouses[0]?.id || "all"}
      userRole="WAREHOUSE"
    />
  );
}

