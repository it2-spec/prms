import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { normalizeDepartment } from "@/lib/format";
import ReceivingTableClient, {
  ReceivingItemRow,
} from "@/components/receiving/ReceivingTableClient";

export const dynamic = "force-dynamic";

export default async function ReceivingsPage() {
  const { user } = await getSessionUser();
  const allowedRoles = [
    "PURCHASING",
    "WAREHOUSE",
    "ADMIN_PRODUKSI",
    "ADMIN_INDIRECT",
    "DEPT_APPROVER",
  ];
  if (!user || !allowedRoles.includes(user.role)) {
    redirect("/login");
  }

  // Batasan Hak Akses Harga:
  // Hanya role PURCHASING yang berhak melihat harga satuan (unit price) dan total nominal.
  // Role Admin Produksi, Admin Indirect, Dept Approver, dan Warehouse TIDAK DAPAT melihat harga.
  const canViewPrice = user.role === "PURCHASING";

  const receivings = await prisma.receiving.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      purchaseOrder: {
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          purchaseRequest: {
            select: {
              department: true,
              requestedBy: { select: { name: true } },
            },
          },
          details: {
            select: {
              id: true,
              itemId: true,
              unitPrice: true,
            },
          },
        },
      },
      delivery: {
        include: {
          supplier: { select: { id: true, name: true } },
        },
      },
      warehouse: { select: { id: true, name: true, code: true } },
      receivedBy: { select: { id: true, name: true } },
      details: {
        include: {
          item: true,
          deliveryDetail: {
            select: {
              id: true,
              unitPrice: true,
              purchaseOrderDetailId: true,
            },
          },
        },
      },
    },
  });

  // Susun data baris per item
  const rows: ReceivingItemRow[] = receivings.flatMap((r) => {
    const dnNumber = r.delivery?.suratJalan || r.delivery?.deliveryNumber || "-";
    const supplierName =
      r.purchaseOrder?.supplier?.name || r.delivery?.supplier?.name || "-";
    const rawDept =
      r.purchaseOrder?.department ||
      r.purchaseOrder?.purchaseRequest?.department ||
      r.purchaseOrder?.purchaseRequest?.requestedBy?.name ||
      r.purchaseOrder?.createdBy?.name ||
      "-";
    const userDept = normalizeDepartment(rawDept);

    return r.details.map((dt) => {
      let price = 0;
      if (canViewPrice) {
        if (dt.deliveryDetail?.unitPrice && Number(dt.deliveryDetail.unitPrice) > 0) {
          price = Number(dt.deliveryDetail.unitPrice);
        } else if (dt.deliveryDetail?.purchaseOrderDetailId) {
          const pod = r.purchaseOrder?.details?.find(
            (p) => p.id === dt.deliveryDetail?.purchaseOrderDetailId
          );
          if (pod?.unitPrice) price = Number(pod.unitPrice);
        } else if (dt.itemId) {
          const pod = r.purchaseOrder?.details?.find((p) => p.itemId === dt.itemId);
          if (pod?.unitPrice) price = Number(pod.unitPrice);
        }

        if (price === 0 && dt.item?.lastUnitPrice) {
          price = Number(dt.item.lastUnitPrice);
        }
      }

      const qty = dt.qtyReceived || 0;
      const totalAmount = canViewPrice ? Math.round(qty * price * 100) / 100 : 0;

      return {
        id: dt.id,
        receivingId: r.id,
        receivingNumber: r.receivingNumber,
        receivedAt: r.receivedAt.toISOString(),
        supplierName,
        dnNumber,
        poNumber: r.purchaseOrder?.poNumber || "-",
        poId: r.purchaseOrderId,
        userDept,
        itemCode: dt.item?.code || "-",
        partName: dt.item?.name || "-",
        unit: dt.item?.unit || "Pcs",
        qty,
        unitPrice: canViewPrice ? price : 0,
        totalAmount,
        picReceiving: r.receivedBy?.name || "-",
        warehouseName: r.warehouse?.name || "-",
        status: r.status,
      };
    });
  });

  return (
    <div className="space-y-4">
      <PageTitle
        title="Receivings"
        subtitle="Daftar laporan penerimaan barang (incoming material & part)"
        breadcrumb={["Receivings"]}
      />

      <ReceivingTableClient initialRows={rows} canViewPrice={canViewPrice} />
    </div>
  );
}
