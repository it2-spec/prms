import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import MaterialStockView from "@/components/stock/MaterialStockView";

export const dynamic = "force-dynamic";

export default async function WarehouseStockPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <MaterialStockView
      warehouses={warehouses}
      initialWarehouseId={dbUser?.warehouseId || "all"}
      userRole="WAREHOUSE"
    />
  );
}
