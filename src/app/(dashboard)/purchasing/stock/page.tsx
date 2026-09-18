import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import MaterialStockView from "@/components/stock/MaterialStockView";

export const dynamic = "force-dynamic";

export default async function PurchasingStockPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <MaterialStockView
      warehouses={warehouses}
      initialWarehouseId="all"
      userRole="PURCHASING"
    />
  );
}
