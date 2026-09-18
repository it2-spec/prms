import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

type CommitPayloadItem = {
  keyItem: string;
  lineNo: number;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  poDetailId: string | null;
  itemId: string | null;
};

type CommitPayloadDelivery = {
  suratJalan: string;
  poNumber: string;
  shipDate: string;
  receiveDate: string;
  poId: string;
  supplierId: string;
  warehouseId: string | null;
  items: CommitPayloadItem[];
};

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { deliveries, defaultWarehouseId } = body as {
      deliveries: CommitPayloadDelivery[];
      defaultWarehouseId?: string;
    };

    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      return NextResponse.json({ error: "Data delivery tidak boleh kosong" }, { status: 400 });
    }

    // Default warehouse fallback if missing
    let fallbackWhId = defaultWarehouseId;
    if (!fallbackWhId) {
      const firstWh = await prisma.warehouse.findFirst({ where: { isActive: true } });
      fallbackWhId = firstWh?.id;
    }

    if (!fallbackWhId) {
      return NextResponse.json({ error: "Tidak ada Master Warehouse yang aktif untuk dijadikan penerima." }, { status: 400 });
    }

    let successCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process each delivery in a sequential transaction or safe loop
    for (const d of deliveries) {
      try {
        const whId = d.warehouseId || fallbackWhId;

        // Double check duplicate SJ
        const existingDlv = await prisma.delivery.findFirst({
          where: { suratJalan: d.suratJalan },
        });

        if (existingDlv) {
          skippedCount++;
          continue;
        }

        const dateObj = new Date(d.receiveDate);
        const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
        const dlvSeq = Math.floor(Math.random() * 8999) + 1000;
        const dlvNumber = `DLV-HIST-${dateStr}-${dlvSeq}`;
        const rcvNumber = `RCV-HIST-${dateStr}-${dlvSeq}`;

        await prisma.$transaction(async (tx) => {
          // 1. Create Delivery
          const delivery = await tx.delivery.create({
            data: {
              deliveryNumber: dlvNumber,
              purchaseOrderId: d.poId,
              supplierId: d.supplierId,
              suratJalan: d.suratJalan,
              shipDate: dateObj,
              status: "ARRIVED",
              createdById: user.id,
              notes: "Import Data Historis Incoming",
            },
          });

          // 2. Create Receiving
          const receiving = await tx.receiving.create({
            data: {
              receivingNumber: rcvNumber,
              deliveryId: delivery.id,
              purchaseOrderId: d.poId,
              warehouseId: whId,
              receivedById: user.id,
              receivedAt: dateObj,
              status: "RECEIVED",
              isManual: false,
              notes: "Import Data Historis Incoming",
            },
          });

          // 3. Process items
          for (const item of d.items) {
            if (!item.poDetailId || !item.itemId) continue;

            // Create DeliveryDetail
            const dlvDetail = await tx.deliveryDetail.create({
              data: {
                deliveryId: delivery.id,
                purchaseOrderDetailId: item.poDetailId,
                itemId: item.itemId,
                qty: item.qty,
                unitPrice: item.unitPrice,
              },
            });

            // Create ReceivingDetail
            await tx.receivingDetail.create({
              data: {
                receivingId: receiving.id,
                deliveryDetailId: dlvDetail.id,
                itemId: item.itemId,
                qtyOrdered: item.qty,
                qtyDelivered: item.qty,
                qtyReceived: item.qty,
              },
            });

            // Increment received & delivered QTY on PO Detail
            await tx.purchaseOrderDetail.update({
              where: { id: item.poDetailId },
              data: {
                receivedQty: { increment: item.qty },
                deliveredQty: { increment: item.qty },
              },
            });
          }

          // 4. Update PO Status
          const allDetails = await tx.purchaseOrderDetail.findMany({
            where: { purchaseOrderId: d.poId },
          });

          const isFullyReceived = allDetails.every((det) => det.receivedQty >= det.qty);
          const isPartiallyReceived = allDetails.some((det) => det.receivedQty > 0);

          let newStatus = undefined;
          if (isFullyReceived) {
            newStatus = "RECEIVED";
          } else if (isPartiallyReceived) {
            newStatus = "PARTIALLY_RECEIVED";
          }

          if (newStatus) {
            await tx.purchaseOrder.update({
              where: { id: d.poId },
              data: { status: newStatus as any },
            });
          }
        });

        successCount++;
      } catch (err: any) {
        console.error(`Error importing SJ ${d.suratJalan}:`, err);
        errors.push(`Surat Jalan ${d.suratJalan}: ${err.message}`);
      }
    }

    await writeAuditLog(
      user,
      "IMPORT_INCOMING",
      "Delivery",
      undefined,
      `Import ${successCount} delivery/receiving dari incoming Excel (Skipped: ${skippedCount}, Error: ${errors.length})`
    );

    return NextResponse.json({
      successCount,
      skippedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (err: any) {
    console.error("commit-incoming error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
