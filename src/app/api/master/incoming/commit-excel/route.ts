import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextNumber, writeAuditLog, normalizeName } from "@/lib/utils";
import { notifyBatchPoImported } from "@/lib/notifications";

export const runtime = "nodejs";

type IncomingRow = {
  poNumber: string;
  itemName: string;
  packageUnit?: string;
  packageSize?: number;
  qty: number;
  unit: string;
  unitPrice?: number;
  supplierName: string;
  poDate: string;
  receivedQty: number;
  suratJalan: string;
  receiveDate: string;
};

function generateItemCode(name: string, usedCodes: Set<string>): string {
  const words = name.trim().split(/\s+/).slice(0, 3);
  let base = words.map(w => w.replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase()).join("-");
  if (!base) base = "ITM";

  let code = base;
  let counter = 1;
  while (usedCodes.has(code.toUpperCase())) {
    code = `${base}-${counter}`;
    counter++;
  }
  usedCodes.add(code.toUpperCase());
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || (user.role !== "PURCHASING" && user.role !== "WAREHOUSE")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { rows } = body as { rows: IncomingRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Data transaksi kosong" }, { status: 400 });
    }

    // 1. Resolve default Warehouse
    let warehouse = await prisma.warehouse.findFirst();
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: { code: "WH001", name: "Gudang Pusat", address: "Kawasan Industri Cikarang" },
      });
    }

    // 2. Resolve Suppliers Map (normalized)
    const existingSuppliers = await prisma.supplier.findMany();
    const supplierMap = new Map<string, string>();
    for (const s of existingSuppliers) {
      supplierMap.set(normalizeName(s.name), s.id);
    }

    async function getOrCreateSupplier(name: string): Promise<string> {
      const key = normalizeName(name);
      if (supplierMap.has(key)) return supplierMap.get(key)!;

      const code = "SUP-" + Math.floor(1000 + Math.random() * 9000);
      const created = await prisma.supplier.create({
        data: { code, name: name.trim() },
      });
      supplierMap.set(key, created.id);
      return created.id;
    }

    // 3. Resolve Items Map (normalized name matching)
    const existingItems = await prisma.item.findMany();
    const itemMap = new Map<string, any>();
    const usedCodes = new Set<string>();
    for (const i of existingItems) {
      itemMap.set(normalizeName(i.name), i);
      usedCodes.add(i.code.toUpperCase());
    }

    async function getOrCreateItem(name: string, packageUnit: string | undefined, packageSize: number | undefined, unit: string, price: number | undefined): Promise<any> {
      const key = normalizeName(name);
      if (itemMap.has(key)) return itemMap.get(key);

      // Fuzzy fallback: when exact match fails (e.g. "pain" vs "paint"),
      // try to find an item whose normalized name is contained within
      // the incoming name or vice versa
      for (const [existingKey, existingItem] of itemMap) {
        if (key.includes(existingKey) || existingKey.includes(key)) {
          return existingItem;
        }
      }

      const code = generateItemCode(name, usedCodes);
      const created = await prisma.item.create({
        data: {
          code,
          name: name.trim(),
          unit: unit || "kg",
          packageUnit: packageUnit || "PAIL",
          packageSize: packageSize || 20,
          lastUnitPrice: (price ?? 0) > 0 ? price : null,
          isActive: true,
        },
      });

      if ((price ?? 0) > 0) {
        await prisma.itemPriceHistory.create({
          data: {
            itemId: created.id,
            oldUnitPrice: null,
            newUnitPrice: price ?? 0,
            source: "Import Incoming Excel",
          },
        });
      }

      itemMap.set(key, created);
      return created;
    }

    // Pre-resolve items & suppliers
    for (const r of rows) {
      await getOrCreateSupplier(r.supplierName);
      await getOrCreateItem(r.itemName, r.packageUnit, r.packageSize, r.unit, r.unitPrice);
    }

    // Group rows by PO
    const poGroupMap = new Map<string, IncomingRow[]>();
    for (const r of rows) {
      if (!poGroupMap.has(r.poNumber)) poGroupMap.set(r.poNumber, []);
      poGroupMap.get(r.poNumber)!.push(r);
    }

    let createdPOs = 0;
    let createdDeliveries = 0;
    let createdReceivings = 0;
    const newPoNumbers: string[] = [];

    // Process each PO
    for (const [poNumber, poRows] of poGroupMap.entries()) {
      const firstRow = poRows[0];
      const supplierId = supplierMap.get(firstRow.supplierName.trim().toLowerCase())!;

      // Check if PO exists
      let po = await prisma.purchaseOrder.findUnique({
        where: { poNumber },
        include: { details: true },
      });
      const poExisted = !!po;

      if (!po) {
        // Group items in PO (combine same item rows for PO details)
        const poItemSummaryMap = new Map<string, { item: any; totalQty: number; unitPrice: number }>();
        for (const r of poRows) {
          const itemObj = itemMap.get(normalizeName(r.itemName))!;
          const existing = poItemSummaryMap.get(itemObj.id);
          if (existing) {
            existing.totalQty += r.qty;
          } else {
            poItemSummaryMap.set(itemObj.id, {
              item: itemObj,
              totalQty: r.qty,
              unitPrice: r.unitPrice ?? 0,
            });
          }
        }

        const poDetailsData = Array.from(poItemSummaryMap.values()).map((summary) => {
          const pkgSize = Number(summary.item.packageSize ?? 20);
          const packageQty = pkgSize > 0 ? Math.ceil(summary.totalQty / pkgSize) : summary.totalQty;
          return {
            itemId: summary.item.id,
            qty: summary.totalQty,
            deliveredQty: summary.totalQty,
            receivedQty: summary.totalQty,
            unitPrice: summary.unitPrice,
            packageUnit: summary.item.packageUnit || "PAIL",
            packageQty,
            receivedPackageQty: packageQty,
            unit: summary.item.unit || "kg",
          };
        });

        po = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            supplierId,
            warehouseId: warehouse.id,
            createdById: user.id,
            poDate: new Date(firstRow.poDate),
            status: "CLOSED",
            details: { create: poDetailsData },
          },
          include: { details: true },
        });
        newPoNumbers.push(poNumber);
        createdPOs++;
      }

      // Build PO detail lookup: itemId -> { id, unitPrice }
      const poDetailIdMap = new Map<string, { id: string; unitPrice: number }>();
      for (const d of po.details) {
        poDetailIdMap.set(d.itemId, { id: d.id, unitPrice: Number(d.unitPrice) });
      }

      // Saat PO sudah ada, item di incoming yang tidak ada di detail PO
      // harus dibuatkan baris PO detail baru (PurchaseOrderDetail) supaya
      // DeliveryDetail.purchaseOrderDetailId (required) terisi. Tanpa ini,
      // prisma.delivery.create() error "Argument purchaseOrderDetail is missing".
      if (poExisted) {
        for (const r of poRows) {
          const itemObj = itemMap.get(normalizeName(r.itemName))!;
          if (poDetailIdMap.has(itemObj.id)) continue;

          const pkgSize = Number(itemObj.packageSize ?? 20) || 20;
          const packageQty = pkgSize > 0 ? Math.ceil(r.qty / pkgSize) : r.qty;
          const newPod = await prisma.purchaseOrderDetail.create({
            data: {
              purchaseOrderId: po.id,
              itemId: itemObj.id,
              qty: r.qty,
              unitPrice: r.unitPrice ?? 0,
              unit: itemObj.unit || r.unit || "kg",
              packageUnit: itemObj.packageUnit || "PAIL",
              packageQty,
              deliveredQty: 0,
              receivedQty: 0,
            },
          });
          poDetailIdMap.set(itemObj.id, { id: newPod.id, unitPrice: Number(newPod.unitPrice) });
          console.log(`[commit-excel] Auto-added PO detail for ${poNumber} / ${itemObj.name} (qty=${r.qty})`);
        }
      }

      // Group PO rows by Surat Jalan (Delivery)
      const sjGroupMap = new Map<string, IncomingRow[]>();
      for (const r of poRows) {
        const sjKey = r.suratJalan || `SJ-${poNumber}`;
        if (!sjGroupMap.has(sjKey)) sjGroupMap.set(sjKey, []);
        sjGroupMap.get(sjKey)!.push(r);
      }

      // Create Deliveries & Receivings for each SJ in this PO
      for (const [suratJalan, sjRows] of sjGroupMap.entries()) {
        const sjFirst = sjRows[0];
        const shipDate = new Date(sjFirst.receiveDate);

        // Check if delivery already exists for this PO & SJ
        let delivery = await prisma.delivery.findFirst({
          where: { purchaseOrderId: po.id, suratJalan },
        });

        if (!delivery) {
          const dlvNum = await nextNumber("delivery");
          delivery = await prisma.delivery.create({
            data: {
              deliveryNumber: dlvNum,
              purchaseOrderId: po.id,
              supplierId,
              suratJalan,
              shipDate,
              status: "ARRIVED",
              createdById: user.id,
              details: {
                create: sjRows.map((r) => {
                  const itemObj = itemMap.get(normalizeName(r.itemName))!;
                  const pod = poDetailIdMap.get(itemObj.id);
                  return {
                    purchaseOrderDetailId: pod!.id,
                    itemId: itemObj.id,
                    qty: r.qty,
                    unitPrice: r.unitPrice || pod?.unitPrice || 0,
                  };
                }),
              },
            },
          });
          createdDeliveries++;
        }

        // Create Receiving for this Delivery if not exists
        const rcvNum = await nextNumber("receiving");
        const existingRcv = await prisma.receiving.findFirst({
          where: { deliveryId: delivery.id },
        });

        if (!existingRcv) {
          await prisma.receiving.create({
            data: {
              receivingNumber: rcvNum,
              deliveryId: delivery.id,
              purchaseOrderId: po.id,
              warehouseId: po.warehouseId ?? warehouse.id,
              receivedById: user.id,
              receivedAt: shipDate,
              status: "RECEIVED",
              isManual: true,
              details: {
                create: sjRows.map((r) => {
                  const itemObj = itemMap.get(normalizeName(r.itemName))!;
                  return {
                    itemId: itemObj.id,
                    qtyOrdered: r.qty,
                    qtyDelivered: r.qty,
                    qtyReceived: r.receivedQty,
                  };
                }),
              },
            },
          });
          createdReceivings++;

          // Saat PO sudah ada sebelumnya, counter receivedQty/deliveredQty
          // di PO detail harus dinaikkan manual (PO baru sudah di-set penuh
          // saat create). Tanpa ini, status PO tidak akan pernah terhitung
          // ulang menjadi CLOSED.
          if (poExisted) {
            for (const r of sjRows) {
              const itemObj = itemMap.get(normalizeName(r.itemName))!;
              const pod = poDetailIdMap.get(itemObj.id);
              if (!pod) continue;
              await prisma.purchaseOrderDetail.update({
                where: { id: pod.id },
                data: {
                  receivedQty: { increment: r.receivedQty },
                  deliveredQty: { increment: r.qty },
                },
              });
            }
          }
        }
      }

      // Hitung ulang status PO (hanya untuk PO yang sudah ada sebelumnya;
      // PO baru sudah di-set CLOSED saat create).
      if (poExisted) {
        const allDetails = await prisma.purchaseOrderDetail.findMany({
          where: { purchaseOrderId: po.id },
        });
        const isFullyReceived = allDetails.every((d) => d.receivedQty >= d.qty);
        const isPartiallyReceived = allDetails.some((d) => d.receivedQty > 0);
        let newStatus: "CLOSED" | "PARTIALLY_RECEIVED" | undefined;
        if (isFullyReceived) newStatus = "CLOSED";
        else if (isPartiallyReceived) newStatus = "PARTIALLY_RECEIVED";
        if (newStatus) {
          await prisma.purchaseOrder.update({
            where: { id: po.id },
            data: { status: newStatus },
          });
        }
      }
    }

    await writeAuditLog(
      user,
      "BATCH_IMPORT_INCOMING",
      "Delivery",
      undefined,
      `Import Incoming: ${createdPOs} PO, ${createdDeliveries} Delivery, ${createdReceivings} Receiving dibuat`
    );

    if (newPoNumbers.length > 0) {
      await notifyBatchPoImported({
        count: newPoNumbers.length,
        poNumbers: newPoNumbers,
        creatorName: user.name,
      });
    }

    return NextResponse.json({
      success: true,
      createdPOs,
      createdDeliveries,
      createdReceivings,
      message: `Import Berhasil! ${createdPOs} PO, ${createdDeliveries} Delivery, dan ${createdReceivings} Receiving baru berhasil disimpan.`,
    });
  } catch (err: any) {
    console.error("commit-incoming-excel error:", err);
    return NextResponse.json({ error: err.message || "Gagal menyimpan data transaksi incoming" }, { status: 500 });
  }
}
