import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import SupplierDeliveriesClient, { DeliveryListItem } from "./SupplierDeliveriesClient";

export const dynamic = "force-dynamic";

export default async function SupplierDeliveriesPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) redirect("/login");

  const rawDeliveries = await prisma.delivery.findMany({
    where: { supplierId: dbUser.supplierId },
    orderBy: { createdAt: "desc" },
    include: {
      purchaseOrder: true,
      details: { include: { item: true } },
      receivings: true,
    },
  });

  const deliveries: DeliveryListItem[] = rawDeliveries.map((d) => ({
    id: d.id,
    deliveryNumber: d.deliveryNumber,
    suratJalan: d.suratJalan,
    shipDate: d.shipDate,
    status: d.status,
    createdAt: d.createdAt,
    poNumber: d.purchaseOrder.poNumber,
    itemCount: d.details.length,
    receivingsCount: d.receivings.length,
    items: d.details.map((det) => ({
      name: det.item.name,
      code: det.item.code,
      qty: det.qty,
      unit: det.item.unit,
    })),
  }));

  return (
    <div className="space-y-4">
      <PageTitle
        title="Deliveries"
        subtitle="Histori pengiriman Anda"
        breadcrumb={["Deliveries"]}
        action={
          <Link href="/supplier/deliveries/new" className="btn btn-primary">
            + Buat Delivery
          </Link>
        }
      />

      <SupplierDeliveriesClient deliveries={deliveries} />
    </div>
  );
}
