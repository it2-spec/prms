import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, PageTitle } from "@/components/ui";
import SupplierPoTableClient, { SupplierPOItem } from "./SupplierPoTableClient";
import { FileText, Clock, PackageCheck, CheckCircle2, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupplierPurchaseOrdersPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) redirect("/login");

  const rawPOs = await prisma.purchaseOrder.findMany({
    where: { supplierId: dbUser.supplierId },
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: true,
      details: {
        include: { item: true },
      },
    },
  });

  const purchaseOrders: SupplierPOItem[] = rawPOs.map((po) => {
    const totalOrderedQty = po.details.reduce((sum, d) => sum + d.qty, 0);
    const totalDeliveredQty = po.details.reduce((sum, d) => sum + d.deliveredQty, 0);
    const totalReceivedQty = po.details.reduce((sum, d) => sum + d.receivedQty, 0);
    const outstandingQty = Math.max(0, totalOrderedQty - totalDeliveredQty);

    const isDeliverable =
      ["WAITING_DELIVERY", "PARTIALLY_DELIVERED", "SENT", "PARTIALLY_RECEIVED"].includes(po.status) &&
      outstandingQty > 0;

    return {
      id: po.id,
      poNumber: po.poNumber,
      poDate: po.poDate,
      status: po.status,
      notes: po.notes,
      warehouseName: po.warehouse?.name ?? "Pusat",
      totalItems: po.details.length,
      totalOrderedQty,
      totalDeliveredQty,
      totalReceivedQty,
      outstandingQty,
      isDeliverable,
      supplierAcceptedAt: po.supplierAcceptedAt,
      supplierAcceptedByName: po.supplierAcceptedByName,
      items: po.details.map((d) => ({
        name: d.item.name,
        code: d.item.code,
        qty: d.qty,
        unit: d.item.unit,
      })),
    };
  });

  const totalCount = purchaseOrders.length;
  const waitingDeliveryCount = purchaseOrders.filter((p) =>
    ["WAITING_DELIVERY", "PARTIALLY_DELIVERED", "SENT"].includes(p.status),
  ).length;
  const inReceivingCount = purchaseOrders.filter((p) =>
    ["WAITING_RECEIVING", "PARTIALLY_RECEIVED"].includes(p.status),
  ).length;
  const closedCount = purchaseOrders.filter((p) => p.status === "CLOSED").length;

  const stats = [
    {
      label: "Total Purchase Order",
      value: totalCount,
      icon: FileText,
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      label: "Perlu Dikirim",
      value: waitingDeliveryCount,
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      label: "Menunggu Penerimaan",
      value: inReceivingCount,
      icon: PackageCheck,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
    {
      label: "Closed",
      value: closedCount,
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title="Purchase Orders"
        subtitle={`Daftar seluruh pesanan pembelian dari PT untuk ${dbUser.supplier?.name ?? "Supplier"}`}
        breadcrumb={["Purchase Orders"]}
        action={
          <Link href="/supplier/deliveries/new" className="btn btn-primary flex items-center gap-1.5">
            <Truck className="h-4 w-4" />
            + Buat Delivery
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} bodyClassName="!p-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${s.color}`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-800">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* PO Table Component */}
      <SupplierPoTableClient purchaseOrders={purchaseOrders} />
    </div>
  );
}
