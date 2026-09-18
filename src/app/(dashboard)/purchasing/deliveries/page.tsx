import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageTitle, Button } from "@/components/ui";
import { FileSpreadsheet } from "lucide-react";
import PurchasingDeliveriesTableClient, {
  PurchasingDeliveryItem,
} from "./PurchasingDeliveriesTableClient";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const rawDeliveries = await prisma.delivery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      purchaseOrder: true,
      details: {
        include: { item: true },
      },
      receivings: true,
    },
  });

  const deliveries: PurchasingDeliveryItem[] = rawDeliveries.map((d) => ({
    id: d.id,
    deliveryNumber: d.deliveryNumber,
    poNumber: d.purchaseOrder.poNumber,
    supplierName: d.supplier.name,
    suratJalan: d.suratJalan,
    shipDate: d.shipDate,
    receivingsCount: d.receivings.length,
    status: d.status,
    items: d.details.map((dt) => ({
      name: dt.item.name,
      code: dt.item.code,
      qty: dt.qty,
      unit: dt.item.unit,
    })),
  }));

  return (
    <div className="space-y-4">
      <PageTitle
        title="Deliveries"
        subtitle="Monitoring pengiriman dari semua supplier"
        breadcrumb={["Deliveries"]}
        action={
          <Link href="/purchasing/deliveries/import">
            <Button variant="secondary" className="gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Import Incoming Excel
            </Button>
          </Link>
        }
      />

      <PurchasingDeliveriesTableClient deliveries={deliveries} />
    </div>
  );
}
