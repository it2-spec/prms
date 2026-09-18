import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog, normalizeName } from "@/lib/utils";
import { findBestMatch } from "@/lib/string-similarity";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 120;

function parseDate(raw: any): Date {
  if (!raw) return new Date();
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

type ReconciledCommitItem = {
  id: string; // purchaseOrderDetailId
  itemId: string;
  code?: string;
  description: string;
  incomingDescription?: string | null;
  incomingCode?: string | null;
  unitPrice?: number;
};

type ReconciledCommitPO = {
  poId: string;
  poNumber: string;
  supplierId: string;
  warehouseId?: string | null;
  items: ReconciledCommitItem[];
  rawShipments: Array<{
    suratJalan: string;
    receiveDate: string;
    code: string;
    partName: string;
    qty: number;
    unit: string;
    unitPrice: number;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pos } = body as { pos: ReconciledCommitPO[] };

    if (!Array.isArray(pos) || pos.length === 0) {
      return NextResponse.json({ error: "Tidak ada data PO yang dipilih untuk disimpan" }, { status: 400 });
    }

    let defaultWh = await prisma.warehouse.findFirst({ where: { isActive: true } });
    if (!defaultWh) {
      defaultWh = await prisma.warehouse.findFirst();
    }

    let itemAliases: Record<string, string> = {};
    try {
      const aliasPath = path.join(process.cwd(), "src", "data", "item-aliases.json");
      if (fs.existsSync(aliasPath)) {
        itemAliases = JSON.parse(fs.readFileSync(aliasPath, "utf-8") || "{}");
      }
    } catch (e) {
      console.warn("Could not load item aliases in commit:", e);
    }

    // Pre-calculate starting sequential counters to prevent race condition / duplicate key collisions
    let maxDlvNum = 0;
    const existingDlv = await prisma.delivery.findMany({ select: { deliveryNumber: true } });
    for (const d of existingDlv) {
      if (d.deliveryNumber?.startsWith("DLV")) {
        const n = parseInt(d.deliveryNumber.slice(3), 10);
        if (!isNaN(n) && n > maxDlvNum) maxDlvNum = n;
      }
    }

    let maxRcvNum = 0;
    const existingRcv = await prisma.receiving.findMany({ select: { receivingNumber: true } });
    for (const r of existingRcv) {
      if (r.receivingNumber?.startsWith("RCV")) {
        const n = parseInt(r.receivingNumber.slice(3), 10);
        if (!isNaN(n) && n > maxRcvNum) maxRcvNum = n;
      }
    }

    let createdDeliveries = 0;
    let createdReceivings = 0;
    let updatedPOs = 0;
    const successfulPONumbers: string[] = [];
    const errors: string[] = [];

    for (const po of pos) {
      try {
        if (!po.poId || !po.rawShipments || po.rawShipments.length === 0) continue;

        const dbPO = await prisma.purchaseOrder.findUnique({
          where: { id: po.poId },
          include: { details: true },
        });
        if (!dbPO) continue;

        const whId = po.warehouseId || dbPO.warehouseId || defaultWh?.id;
        if (!whId) {
          errors.push(`PO ${po.poNumber}: Warehouse tidak ditemukan`);
          continue;
        }

        // Map incoming part/code to PO detail id and item id
        function findMatchingDetail(shipment: { code: string; partName: string }) {
          const sCode = (shipment.code || "").toUpperCase();
          const sName = normalizeName(shipment.partName);

          // 1. Check po.items (contains mappings established during reconciliation preview)
          for (const item of po.items) {
            if (item.incomingCode && item.incomingCode.toUpperCase() === sCode) return item;
            if (item.incomingDescription && normalizeName(item.incomingDescription) === sName) return item;
            if (item.code && item.code.toUpperCase() === sCode) return item;
            if (normalizeName(item.description) === sName) return item;
          }

          // 2. Check saved itemAliases
          const savedTarget = (sCode && itemAliases[sCode]) || itemAliases[shipment.partName.toUpperCase()] || itemAliases[sName.toUpperCase()];
          if (savedTarget) {
            const targetNorm = normalizeName(savedTarget);
            for (const item of po.items) {
              if (normalizeName(item.description) === targetNorm || (item.code && item.code.toUpperCase() === savedTarget.toUpperCase())) {
                return item;
              }
            }
          }

          // 3. Fallback: Fuzzy matching against item description or incomingDescription
          const fuzzyMatch = findBestMatch(
            shipment.partName,
            po.items,
            (item) => item.incomingDescription || item.description,
            0.75
          );
          if (fuzzyMatch) {
            return fuzzyMatch.candidate;
          }

          return null;
        }

        // Group raw shipments by Surat Jalan AND Date (to differentiate multi-date shipments sharing the same SJ)
        type ShipmentGroup = {
          suratJalan: string;
          shipDate: Date;
          ships: typeof po.rawShipments;
        };
        const sjGroups = new Map<string, ShipmentGroup>();
        for (const ship of po.rawShipments) {
          const suratJalan = (ship.suratJalan || `SJ-${po.poNumber}`).trim();
          const shipDate = parseDate(ship.receiveDate);
          const dateKey = !isNaN(shipDate.getTime()) ? shipDate.toISOString().split("T")[0] : "NODATE";
          const groupKey = `${suratJalan}___${dateKey}`;

          if (!sjGroups.has(groupKey)) {
            sjGroups.set(groupKey, { suratJalan, shipDate, ships: [] });
          }
          sjGroups.get(groupKey)!.ships.push(ship);
        }

        await prisma.$transaction(async (tx) => {
          for (const { suratJalan, shipDate, ships } of sjGroups.values()) {
            const hasValidDate = !isNaN(shipDate.getTime());
            const startOfDay = new Date(shipDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(shipDate);
            endOfDay.setHours(23, 59, 59, 999);

            // 1. Check or create Delivery
            let delivery = await tx.delivery.findFirst({
              where: {
                purchaseOrderId: po.poId,
                suratJalan,
                ...(hasValidDate
                  ? {
                      shipDate: {
                        gte: startOfDay,
                        lte: endOfDay,
                      },
                    }
                  : {}),
              },
            });

            if (!delivery) {
              maxDlvNum++;
              const dlvNum = `DLV${String(maxDlvNum).padStart(6, "0")}`;
              delivery = await tx.delivery.create({
                data: {
                  deliveryNumber: dlvNum,
                  purchaseOrderId: po.poId,
                  supplierId: po.supplierId || dbPO.supplierId,
                  suratJalan,
                  shipDate,
                  status: "ARRIVED",
                  createdById: user.id,
                  notes: "Input dari Rekonsiliasi PO",
                },
              });
              createdDeliveries++;
            }

            // 2. Check or create Receiving
            let receiving = await tx.receiving.findFirst({
              where: { deliveryId: delivery.id },
            });

            if (!receiving) {
              maxRcvNum++;
              const rcvNum = `RCV${String(maxRcvNum).padStart(6, "0")}`;
              receiving = await tx.receiving.create({
                data: {
                  receivingNumber: rcvNum,
                  deliveryId: delivery.id,
                  purchaseOrderId: po.poId,
                  warehouseId: whId,
                  receivedById: user.id,
                  receivedAt: shipDate,
                  status: "RECEIVED",
                  isManual: true,
                  notes: "Input dari Rekonsiliasi PO",
                },
              });
              createdReceivings++;
            }

            // Aggregate shipments within this delivery group by matched PO detail
            const itemMap = new Map<
              string,
              {
                matched: NonNullable<ReturnType<typeof findMatchingDetail>>;
                totalQty: number;
                unitPrice: number;
              }
            >();

            for (const ship of ships) {
              const matched = findMatchingDetail(ship);
              if (!matched) continue;

              const existing = itemMap.get(matched.id);
              if (existing) {
                existing.totalQty += ship.qty;
              } else {
                itemMap.set(matched.id, {
                  matched,
                  totalQty: ship.qty,
                  unitPrice: ship.unitPrice || matched.unitPrice || 0,
                });
              }
            }

            // 3. Create or update details for items in this shipment
            for (const { matched, totalQty, unitPrice } of itemMap.values()) {
              let deliveryDetail = await tx.deliveryDetail.findFirst({
                where: {
                  deliveryId: delivery.id,
                  purchaseOrderDetailId: matched.id,
                },
              });

              if (!deliveryDetail) {
                deliveryDetail = await tx.deliveryDetail.create({
                  data: {
                    deliveryId: delivery.id,
                    purchaseOrderDetailId: matched.id,
                    itemId: matched.itemId,
                    qty: totalQty,
                    unitPrice,
                  },
                });
              } else if (deliveryDetail.qty !== totalQty) {
                deliveryDetail = await tx.deliveryDetail.update({
                  where: { id: deliveryDetail.id },
                  data: { qty: totalQty, unitPrice },
                });
              }

              // Check if ReceivingDetail already exists for this receiving and deliveryDetail
              const existingRcvDetail = await tx.receivingDetail.findFirst({
                where: {
                  receivingId: receiving.id,
                  deliveryDetailId: deliveryDetail.id,
                },
              });

              if (!existingRcvDetail) {
                await tx.receivingDetail.create({
                  data: {
                    receivingId: receiving.id,
                    deliveryDetailId: deliveryDetail.id,
                    itemId: matched.itemId,
                    qtyOrdered: totalQty,
                    qtyDelivered: totalQty,
                    qtyReceived: totalQty,
                  },
                });
              } else if (existingRcvDetail.qtyReceived !== totalQty) {
                await tx.receivingDetail.update({
                  where: { id: existingRcvDetail.id },
                  data: {
                    qtyOrdered: totalQty,
                    qtyDelivered: totalQty,
                    qtyReceived: totalQty,
                  },
                });
              }
            }
          }

          // 4. Recalculate accurate total receivedQty and receivedPackageQty for all details of this PO
          const allDetails = await tx.purchaseOrderDetail.findMany({
            where: { purchaseOrderId: po.poId },
            include: {
              item: true,
              deliveryDetails: {
                include: { receivings: true },
              },
            },
          });

          for (const d of allDetails) {
            let totalReceived = 0;
            let totalDelivered = 0;
            for (const dd of d.deliveryDetails) {
              totalDelivered += dd.qty;
              for (const rd of dd.receivings) {
                totalReceived += rd.qtyReceived;
              }
            }

            const pkgSize = d.item?.packageSize ? Number(d.item.packageSize) : null;
            const receivedPackageQty = pkgSize && pkgSize > 0
              ? Math.floor(totalReceived / pkgSize)
              : 0;

            await tx.purchaseOrderDetail.update({
              where: { id: d.id },
              data: {
                receivedQty: totalReceived,
                deliveredQty: totalDelivered,
                receivedPackageQty,
              },
            });
          }

          // 5. Update PO Status
          const refreshedDetails = await tx.purchaseOrderDetail.findMany({
            where: { purchaseOrderId: po.poId },
          });
          const allReceived = refreshedDetails.length > 0 && refreshedDetails.every((d) => d.receivedQty >= d.qty);
          const anyReceived = refreshedDetails.some((d) => d.receivedQty > 0);

          let newStatus = dbPO.status;
          if (allReceived) {
            newStatus = "CLOSED";
          } else if (anyReceived) {
            newStatus = "PARTIALLY_RECEIVED";
          }

          if (newStatus !== dbPO.status) {
            await tx.purchaseOrder.update({
              where: { id: po.poId },
              data: { status: newStatus },
            });
          }
        });

        updatedPOs++;
        successfulPONumbers.push(po.poNumber);
      } catch (poErr: any) {
        console.error(`Error committing PO ${po.poNumber}:`, poErr);
        errors.push(`PO ${po.poNumber}: ${poErr.message}`);
      }
    }

    await writeAuditLog(
      user,
      "RECONCILE_COMMIT_INCOMING",
      "Receiving",
      undefined,
      `Input ${createdReceivings} penerimaan dan ${createdDeliveries} pengiriman dari Rekonsiliasi PO (${updatedPOs} PO diupdate)`
    );

    return NextResponse.json({
      success: errors.length === 0,
      updatedPOs,
      successfulPONumbers,
      createdDeliveries,
      createdReceivings,
      errorCount: errors.length,
      errors,
    });
  } catch (err: any) {
    console.error("reconcile-po commit error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
