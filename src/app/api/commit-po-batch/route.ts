import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog, normalizeName } from "@/lib/utils";
import { notifyBatchPoImported } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pos } = body;

    if (!Array.isArray(pos) || pos.length === 0) {
      return NextResponse.json({ error: "Tidak ada data PO untuk disimpan" }, { status: 400 });
    }

    let createdPoCount = 0;
    let createdItemCount = 0;
    let createdSupCount = 0;
    let createdWhCount = 0;
    let priceChanges = 0;
    const createdPoNumbers: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Maps to prevent duplicate creation in the same batch run
      const supplierCache = new Map<string, string>(); // name.toLowerCase() -> supplierId
      const itemCache = new Map<string, { id: string; packageSize: number | null; packageUnit: string | null; unit: string | null; lastUnitPrice: number | null; updatedPkg?: boolean }>();
      const warehouseCache = new Map<string, string>();// name.toLowerCase() -> warehouseId

      // Sets to track all used codes and ensure absolute uniqueness
      const usedSupCodes = new Set<string>();
      const usedItemCodes = new Set<string>();
      const usedWhCodes = new Set<string>();

      // Load existing suppliers, items, warehouses into cache and code sets
      const existingSups = await tx.supplier.findMany();
      for (const s of existingSups) {
        supplierCache.set(s.name.toLowerCase(), s.id);
        usedSupCodes.add(s.code.toUpperCase());
      }

      const existingItems = await tx.item.findMany();
      for (const i of existingItems) {
        const itemData = {
          id: i.id,
          packageSize: i.packageSize ? Number(i.packageSize) : null,
          packageUnit: i.packageUnit,
          unit: i.unit,
          lastUnitPrice: i.lastUnitPrice ? Number(i.lastUnitPrice) : null,
        };
        itemCache.set(normalizeName(i.name), itemData);
        itemCache.set(i.code.toLowerCase(), itemData);
        usedItemCodes.add(i.code.toUpperCase());
      }

      const existingWhs = await tx.warehouse.findMany();
      for (const w of existingWhs) {
        warehouseCache.set(w.name.toLowerCase(), w.id);
        warehouseCache.set(w.code.toLowerCase(), w.id);
        usedWhCodes.add(w.code.toUpperCase());
      }

      function resolveUniqueCode(requestedCode: string | undefined, prefix: string, usedSet: Set<string>): string {
        let code = (requestedCode || "").trim();
        if (code && !usedSet.has(code.toUpperCase())) {
          usedSet.add(code.toUpperCase());
          return code;
        }
        let counter = 1;
        while (true) {
          const candidate = `${prefix}-${String(counter).padStart(3, "0")}`;
          if (!usedSet.has(candidate.toUpperCase())) {
            usedSet.add(candidate.toUpperCase());
            return candidate;
          }
          counter++;
        }
      }

      for (const group of pos) {
        // Skip duplicate POs if already exists
        const poExists = await tx.purchaseOrder.findUnique({
          where: { poNumber: group.poNumber },
        });
        if (poExists) continue;

        // 1. Resolve or Auto-Create Supplier
        let finalSupplierId = group.matchedSupplierId;
        const supName = (group.supplierName || group.suggestedSupplierName || "Supplier Baru").trim();
        const supNameKey = supName.toLowerCase();

        if (supplierCache.has(supNameKey)) {
          finalSupplierId = supplierCache.get(supNameKey)!;
          // Optionally update address/phone/contactPerson if empty
          if (group.supplierAddress || group.supplierPhone || group.supplierContactPerson) {
            await tx.supplier.update({
              where: { id: finalSupplierId },
              data: {
                address: group.supplierAddress || undefined,
                phone: group.supplierPhone || undefined,
                contactPerson: group.supplierContactPerson || undefined,
              },
            });
          }
        } else if (!finalSupplierId) {
          const supCode = resolveUniqueCode(group.suggestedSupplierCode, "SUP-AUTO", usedSupCodes);
          const newSup = await tx.supplier.create({
            data: {
              code: supCode,
              name: supName,
              address: group.supplierAddress || null,
              phone: group.supplierPhone || null,
              contactPerson: group.supplierContactPerson || null,
              isActive: true,
            },
          });
          finalSupplierId = newSup.id;
          supplierCache.set(supNameKey, newSup.id);
          createdSupCount++;
        }

        // 2. Resolve or Auto-Create Warehouse
        let finalWarehouseId = group.matchedWarehouseId;
        const whName = (group.warehouseName || "Gudang Pusat").trim();
        const whNameKey = whName.toLowerCase();

        if (warehouseCache.has(whNameKey)) {
          finalWarehouseId = warehouseCache.get(whNameKey)!;
        } else if (!finalWarehouseId) {
          const whCode = resolveUniqueCode(group.suggestedWarehouseCode, "WH-AUTO", usedWhCodes);
          const newWh = await tx.warehouse.create({
            data: {
              code: whCode,
              name: whName,
              isActive: true,
            },
          });
          finalWarehouseId = newWh.id;
          warehouseCache.set(whNameKey, newWh.id);
          createdWhCount++;
        }

        // 3. Resolve or Auto-Create Items, compute packageQty, detect price changes
        const poDetailsData: {
          itemId: string;
          qty: number;
          unit?: string;
          packageUnit?: string | null;
          packageQty?: number | null;
          unitPrice: number;
        }[] = [];

        for (const item of group.items) {
          // Safeguard: do not create PO details for zero or negative quantity items
          if (!item.qty || Number(item.qty) <= 0) continue;

          let finalItemId = item.matchedItemId;
          const itemName = (item.description || item.suggestedItemName || "Item Baru").trim();
          const itemNameKey = normalizeName(itemName);

          let masterItem = itemCache.get(itemNameKey);

          if (!masterItem && finalItemId) {
            // If matched by id but not in cache yet, load it
            const dbItem = await tx.item.findUnique({ where: { id: finalItemId } });
            if (dbItem) {
              masterItem = {
                id: dbItem.id,
                packageSize: dbItem.packageSize ? Number(dbItem.packageSize) : null,
                packageUnit: dbItem.packageUnit,
                unit: dbItem.unit,
                lastUnitPrice: dbItem.lastUnitPrice ? Number(dbItem.lastUnitPrice) : null,
              };
              itemCache.set(itemNameKey, masterItem);
            }
          }

          if (masterItem) {
            finalItemId = masterItem.id;
            // Update packageUnit/packageSize di master jika belum terisi dan PO punya info konversi
            const pkgSizeFromPO = (item as any).packageSize as number | null | undefined;
            const pkgUnitFromPO = (item as any).packageUnit as string | null | undefined;
            if (
              pkgSizeFromPO && pkgSizeFromPO > 0 &&
              (!masterItem.packageSize || !masterItem.packageUnit) &&
              !masterItem.updatedPkg
            ) {
              await tx.item.update({
                where: { id: finalItemId },
                data: {
                  packageUnit: pkgUnitFromPO || masterItem.packageUnit,
                  packageSize: pkgSizeFromPO,
                  unit: masterItem.unit || item.unit || "kg",
                },
              });
              masterItem.packageUnit = pkgUnitFromPO || masterItem.packageUnit;
              masterItem.packageSize = pkgSizeFromPO;
              masterItem.updatedPkg = true;
            }
          } else if (!finalItemId) {
            // Auto-create new item (no Master Item match)
            const pkgSizeFromPO = (item as any).packageSize as number | null | undefined;
            const pkgUnitFromPO = (item as any).packageUnit as string | null | undefined;
            const itemCode = resolveUniqueCode(item.suggestedItemCode, "ITM-AUTO", usedItemCodes);
            const newItem = await tx.item.create({
              data: {
                code: itemCode,
                name: itemName,
                unit: item.unit || "kg",
                packageUnit: pkgUnitFromPO || null,
                packageSize: pkgSizeFromPO || null,
                lastUnitPrice: item.unitPrice > 0 ? item.unitPrice : null,
                isActive: true,
              },
            });
            finalItemId = newItem.id;
            masterItem = {
              id: newItem.id,
              packageSize: pkgSizeFromPO || null,
              packageUnit: pkgUnitFromPO || null,
              unit: item.unit || "kg",
              lastUnitPrice: item.unitPrice > 0 ? item.unitPrice : null,
              updatedPkg: true,
            };
            itemCache.set(itemNameKey, masterItem);
            createdItemCount++;
          }

          // ─── Resolusi packageQty / packageUnit ───────────────────────────
          // Utamakan data langsung dari parsed PO (sudah dihitung di parse-po-rekap)
          const parsedPkgQty = (item as any).packageQty as number | null | undefined;
          const parsedPkgUnit = (item as any).packageUnit as string | null | undefined;
          const pkgSize = masterItem?.packageSize && masterItem.packageSize > 0
            ? masterItem.packageSize
            : ((item as any).packageSize as number | null | undefined) || null;
          // Gunakan packageQty dari parser; fallback hitung dari masterItem.packageSize
          const packageQty = parsedPkgQty != null
            ? parsedPkgQty
            : pkgSize
              ? Math.round((Number(item.qty) / pkgSize) * 100) / 100
              : null;
          const resolvedPackageUnit = parsedPkgUnit || masterItem?.packageUnit || null;
          const resolvedUnit = masterItem?.unit || item.unit || "kg";

          // ─── Deteksi Perubahan Harga ──────────────────────────────────────
          const newPrice = Number(item.unitPrice) || 0;
          if (newPrice > 0 && finalItemId) {
            const oldPrice = masterItem?.lastUnitPrice ?? null;
            const isDifferent = oldPrice === null || Math.abs((oldPrice ?? 0) - newPrice) > 0.01;

            if (isDifferent) {
              // Catat riwayat perubahan harga
              await tx.itemPriceHistory.create({
                data: {
                  itemId: finalItemId,
                  oldUnitPrice: oldPrice,
                  newUnitPrice: newPrice,
                  source: `PO #${group.poNumber}`,
                },
              });
              // Update harga terkini di master item
              await tx.item.update({
                where: { id: finalItemId },
                data: { lastUnitPrice: newPrice },
              });
              // Update cache
              if (masterItem) masterItem.lastUnitPrice = newPrice;
              priceChanges++;
            }
          }

          poDetailsData.push({
            itemId: finalItemId,
            qty: Math.max(1, Number(item.qty) || 1),
            unit: resolvedUnit,
            packageUnit: resolvedPackageUnit,
            packageQty: packageQty,
            unitPrice: newPrice,
          });
        }

        // 4. Create Purchase Order (status SENT so supplier can immediately deliver)
        const poDate = group.poDate ? new Date(group.poDate) : new Date();
        await tx.purchaseOrder.create({
          data: {
            poNumber: group.poNumber,
            supplierId: finalSupplierId,
            warehouseId: finalWarehouseId,
            createdById: user.id,
            poDate: isNaN(poDate.getTime()) ? new Date() : poDate,
            department: group.department || null,
            purposeProject: group.purposeProject || null,
            status: "SENT",
            details: {
              create: poDetailsData,
            },
          },
        });

        createdPoNumbers.push(group.poNumber);
        createdPoCount++;
      }
    });

    await writeAuditLog(
      user,
      "BATCH_IMPORT_PO",
      "PurchaseOrder",
      undefined,
      `Import ${createdPoCount} PO (${createdSupCount} supplier, ${createdWhCount} warehouse, ${createdItemCount} item baru, ${priceChanges} perubahan harga)`
    );

    if (createdPoNumbers.length > 0) {
      await notifyBatchPoImported({
        count: createdPoNumbers.length,
        poNumbers: createdPoNumbers,
        creatorName: user.name,
      });
    }

    return NextResponse.json({
      success: true,
      createdPoCount,
      createdItemCount,
      createdSupCount,
      createdWhCount,
      priceChanges,
      message: `Berhasil mengimpor ${createdPoCount} PO (${priceChanges} perubahan harga terdeteksi)`,
    });
  } catch (error: any) {
    console.error("Batch commit error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan batch PO" }, { status: 500 });
  }
}
