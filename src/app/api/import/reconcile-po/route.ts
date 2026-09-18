import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { normalizeName } from "@/lib/utils";
import { findBestMatch } from "@/lib/string-similarity";

export const runtime = "nodejs";
export const maxDuration = 120;

function normalizePONumber(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * POST /api/import/reconcile-po
 *
 * Upload incoming.xlsx → bandingkan dengan semua PO di database
 * Hasilkan laporan rekonsiliasi berbasis data Master Item (Item.packageSize & Item.packageUnit)
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File incoming tidak ditemukan" }, { status: 400 });
    }

    // ── Parse incoming.xlsx ────────────────────────────────────────────────
    // Format template: NO | RECEIVING DATE | SUPPLIER NAME | PACKAGING |
    //   NO. DN | PO NO. | USER | CODE | PART NAME | UNIT | QTY | UNIT PRICE | TOTAL AMOUNT
    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer as any);
    const ws = wb.worksheets[0];

    // ── Deteksi header row dan kolom secara dinamis ─────────────────────────
    let headerRow = 1;
    let colPONo = 6, colCode = 8, colPartName = 9, colUnit = 10;
    let colQty = 11, colDN = 5, colReceiveDate = 2, colPackaging = 4, colUnitPrice = 12;

    ws.eachRow((row, rn) => {
      if (rn > 5) return;
      for (let c = 1; c <= 20; c++) {
        const v = String(row.getCell(c).value ?? "").trim().toUpperCase();
        if (v === "PO NO." || v === "PO NO" || v === "PO NUMBER" || v === "NOMOR PO") { headerRow = rn; colPONo = c; }
        else if ((v === "CODE" || v === "KODE") && rn === headerRow) colCode = c;
        else if ((v === "PART NAME" || v === "PART" || v === "DESCRIPTIONS" || v === "DESCRIPTION") && rn === headerRow) colPartName = c;
        else if ((v === "UNIT" || v === "SATUAN") && rn === headerRow) colUnit = c;
        else if ((v === "QTY" || v === "QUANTITY") && rn === headerRow) colQty = c;
        else if ((v === "NO. DN" || v === "NO DN" || v.includes("SURAT JALAN") || v === "NO SJ") && rn === headerRow) colDN = c;
        else if ((v === "RECEIVING DATE" || v === "RECEIVE DATE" || v === "RECEIVED DATE" || v === "TGL RECEIVE") && rn === headerRow) colReceiveDate = c;
        else if ((v === "PACKAGING" || v === "KEMASAN") && rn === headerRow) colPackaging = c;
        else if ((v === "UNIT PRICE" || v === "HARGA" || v === "PRICE") && rn === headerRow) colUnitPrice = c;
      }
    });

    type IncomingItem = {
      code: string; // item code e.g. "SI9", "SI16"
      description: string;
      receivedQty: number;
      unit: string;
      suratJalans: string[];
    };
    type RawShipment = {
      suratJalan: string;
      receiveDate: string;
      code: string;
      partName: string;
      qty: number;
      unit: string;
      unitPrice: number;
    };
    type IncomingPO = {
      poNumber: string;
      items: Map<string, IncomingItem>; // item code → aggregated item
      rawShipments: RawShipment[];
    };

    const incomingPOMap = new Map<string, IncomingPO>();

    ws.eachRow((row, rn) => {
      if (rn <= headerRow) return;
      const poNo = String(row.getCell(colPONo).value ?? "").trim();
      if (!poNo) return;

      const code = String(row.getCell(colCode).value ?? "").trim().toUpperCase();
      const partName = String(row.getCell(colPartName).value ?? "").trim();
      const unit = String(row.getCell(colUnit).value ?? "").trim();
      const qty = Number(row.getCell(colQty).value) || 0;
      const dn = String(row.getCell(colDN).value ?? "").trim();
      const unitPrice = Number(row.getCell(colUnitPrice).value) || 0;
      const receiveDate = String(row.getCell(colReceiveDate).value ?? "").trim();

      const poNorm = normalizePONumber(poNo);

      if (!incomingPOMap.has(poNorm)) {
        incomingPOMap.set(poNorm, { poNumber: poNo, items: new Map(), rawShipments: [] });
      }

      const inPO = incomingPOMap.get(poNorm)!;
      inPO.rawShipments.push({
        suratJalan: dn,
        receiveDate,
        code,
        partName,
        qty,
        unit,
        unitPrice,
      });

      // Group by item code (primary) or by normalized part name (fallback if no code)
      const groupKey = code || normalizeName(partName);

      if (inPO.items.has(groupKey)) {
        const existing = inPO.items.get(groupKey)!;
        existing.receivedQty += qty;
        if (dn && !existing.suratJalans.includes(dn)) existing.suratJalans.push(dn);
      } else {
        inPO.items.set(groupKey, {
          code,
          description: partName,
          receivedQty: qty,
          unit,
          suratJalans: dn ? [dn] : [],
        });
      }
    });

    // ── Load Item Aliases ──────────────────────────────────────────────────
    let itemAliases: Record<string, string> = {};
    try {
      const aliasPath = path.join(process.cwd(), "src", "data", "item-aliases.json");
      if (fs.existsSync(aliasPath)) {
        itemAliases = JSON.parse(fs.readFileSync(aliasPath, "utf-8") || "{}");
      }
    } catch (e) {
      console.warn("Could not load item aliases:", e);
    }

    // ── Fetch all POs from DB ──────────────────────────────────────────────
    const dbPOs = await prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        details: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            unit: true,
            packageUnit: true,
            packageQty: true,
            unitPrice: true,
            item: { select: { name: true, code: true, unit: true, packageUnit: true, packageSize: true } },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { poNumber: "asc" },
    });

    const dbPOMap = new Map<string, typeof dbPOs[0]>();
    for (const p of dbPOs) {
      dbPOMap.set(normalizePONumber(p.poNumber), p);
    }

    // ── Incoming-Centric Reconcile: Hanya proses PO yang ada di file Incoming ─
    const reconciled = [];
    const notInDB: string[] = [];

    for (const [normPO, inPO] of incomingPOMap.entries()) {
      const dbPO = dbPOMap.get(normPO);
      if (!dbPO) {
        notInDB.push(inPO.poNumber);
        continue;
      }

      // Daftar item incoming yang tersedia untuk PO ini
      const availableIncoming = Array.from(inPO.items.values());
      const claimedKeys = new Set<string>();

      // Match items: Alias → Code Exact → Name Exact → Fuzzy Name
      const itemReconcile = dbPO.details.map((d) => {
        const dbItemCode = (d.item.code || "").toUpperCase();
        const dbItemName = d.item.name;
        let matched: IncomingItem | null = null;
        let matchType: "EXACT" | "FUZZY" | "ALIAS" | "NONE" = "NONE";
        let matchScore = 0;

        // 0. Prioritas 0: Cek Saved Alias
        for (const inc of availableIncoming) {
          const key = inc.code || normalizeName(inc.description);
          if (claimedKeys.has(key)) continue;
          const savedTarget = itemAliases[key.toUpperCase()] || itemAliases[inc.description.toUpperCase()];
          if (savedTarget && (savedTarget.toUpperCase() === dbItemName.toUpperCase() || savedTarget.toUpperCase() === dbItemCode)) {
            matched = inc;
            matchType = "ALIAS";
            matchScore = 100;
            break;
          }
        }

        // 1. Prioritas 1: cocokkan berdasarkan KODE ITEM (paling andal)
        if (!matched && dbItemCode) {
          for (const inc of availableIncoming) {
            const key = inc.code || normalizeName(inc.description);
            if (claimedKeys.has(key)) continue;
            if (inc.code && inc.code === dbItemCode) {
              matched = inc;
              matchType = "EXACT";
              matchScore = 100;
              break;
            }
          }
        }

        // 2. Prioritas 2: cocokkan berdasarkan nama persis
        if (!matched) {
          for (const inc of availableIncoming) {
            const key = inc.code || normalizeName(inc.description);
            if (claimedKeys.has(key)) continue;
            if (normalizeName(inc.description) === normalizeName(dbItemName)) {
              matched = inc;
              matchType = "EXACT";
              matchScore = 100;
              break;
            }
          }
        }

        // 3. Fallback: Smart Fuzzy Match berdasarkan nama
        if (!matched) {
          const unclaimed = availableIncoming.filter((inc) => !claimedKeys.has(inc.code || normalizeName(inc.description)));
          const fuzzyRes = findBestMatch(dbItemName, unclaimed, (c) => c.description, 0.78);
          if (fuzzyRes) {
            matched = fuzzyRes.candidate;
            matchType = fuzzyRes.matchType;
            matchScore = Math.round(fuzzyRes.score * 100);
          }
        }

        // Tandai item incoming sudah dipasangkan
        if (matched) {
          claimedKeys.add(matched.code || normalizeName(matched.description));
        }

        const orderedQty = d.qty;
        const receivedQty = matched?.receivedQty ?? 0;

        // ── Kunci Konversi Pail/Kemasan dari Master Item ──────────────────
        const masterPkgSize = d.item.packageSize ? Number(d.item.packageSize) : null;
        const packageUnit = d.item.packageUnit || d.packageUnit || null;

        const packageQty = masterPkgSize && masterPkgSize > 0
          ? Math.round((orderedQty / masterPkgSize) * 100) / 100
          : d.packageQty;

        const receivedPackageQty = masterPkgSize && masterPkgSize > 0
          ? Math.round((receivedQty / masterPkgSize) * 100) / 100
          : null;

        const completionPct = orderedQty > 0
          ? (receivedQty >= orderedQty ? 100 : Math.min(99, Math.floor((receivedQty / orderedQty) * 100)))
          : 0;
        const status = completionPct >= 100 ? ("COMPLETE" as const)
          : completionPct > 0 ? ("PARTIAL" as const)
          : ("PENDING" as const);

        return {
          id: d.id,
          itemId: d.itemId,
          code: d.item.code,
          description: d.item.name,
          unitPrice: Number(d.unitPrice),
          orderedQty,
          orderedUnit: d.unit || d.item.unit || "kg",
          packageQty,
          packageUnit,
          packageSize: masterPkgSize,
          receivedQty,
          receivedPackageQty,
          completionPct,
          status,
          suratJalans: matched?.suratJalans ?? [],
          matchType,
          matchScore,
          incomingDescription: matched?.description ?? null,
          incomingCode: matched?.code ?? null,
        };
      });

      // Item PO yang belum terpenuhi (unclaimed PO items) untuk suggestion
      const unfulfilledPOItems = itemReconcile.filter((i) => i.receivedQty < i.orderedQty);

      // Item di incoming yang tidak cocok dengan item PO mana pun di database
      const unmatchedIncomingItems = availableIncoming
        .filter((inc) => !claimedKeys.has(inc.code || normalizeName(inc.description)))
        .map((inc) => {
          // Cari rekomendasi pasangan dari item PO yang belum terpenuhi
          const suggestions = unfulfilledPOItems.map((poi) => {
            let rank = 0;
            let reason = "";
            if (poi.orderedQty === inc.receivedQty) {
              rank += 50;
              reason = `QTY sama persis (${inc.receivedQty} ${inc.unit || poi.orderedUnit})`;
            }
            if (inc.code && poi.code && inc.code.toUpperCase() === poi.code.toUpperCase()) {
              rank += 80;
              reason = reason ? `${reason}, Kode sama (${poi.code})` : `Kode sama (${poi.code})`;
            } else if (inc.code && poi.code && (inc.code.includes(poi.code) || poi.code.includes(inc.code))) {
              rank += 30;
              reason = reason ? `${reason}, Kode mirip (${inc.code} ≈ ${poi.code})` : `Kode mirip (${inc.code} ≈ ${poi.code})`;
            }
            return {
              poItemDescription: poi.description,
              poItemCode: poi.code,
              orderedQty: poi.orderedQty,
              orderedUnit: poi.orderedUnit,
              rank,
              reason: reason || "Item PO yang belum terpenuhi",
            };
          }).sort((a, b) => b.rank - a.rank);

          return {
            code: inc.code,
            description: inc.description,
            orderedQty: 0,
            receivedQty: inc.receivedQty,
            unit: inc.unit,
            suratJalans: inc.suratJalans,
            suggestedMatch: suggestions.length > 0 && suggestions[0].rank > 0 ? suggestions[0] : null,
          };
        });

      const completedItems = itemReconcile.filter((i) => i.status === "COMPLETE").length;
      const totalItems = itemReconcile.length;
      const overallPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      const reconcileStatus =
        completedItems === totalItems ? ("CLOSED" as const)
        : completedItems > 0 ? ("PARTIAL" as const)
        : ("PENDING" as const);

      // Hitung perbedaan nama / discrepancy
      const discrepancyCount = unmatchedIncomingItems.length +
        itemReconcile.filter((i) => i.matchType === "FUZZY" || (i.status === "PENDING" && unmatchedIncomingItems.length > 0)).length;

      // Daftar semua baris fisik yang tercatat di Incoming untuk PO ini
      const allIncomingItems = availableIncoming.map((inc) => ({
        code: inc.code,
        description: inc.description,
        receivedQty: inc.receivedQty,
        unit: inc.unit,
        suratJalans: inc.suratJalans,
        isMatched: claimedKeys.has(inc.code || normalizeName(inc.description)),
      }));

      reconciled.push({
        poNumber: dbPO.poNumber,
        poId: dbPO.id,
        supplierId: dbPO.supplier.id,
        supplierName: dbPO.supplier.name,
        warehouseId: dbPO.warehouse?.id ?? null,
        warehouseName: dbPO.warehouse?.name ?? "-",
        inIncoming: true,
        reconcileStatus,
        items: itemReconcile,
        unmatchedIncomingItems,
        allIncomingItems,
        rawShipments: inPO.rawShipments,
        discrepancyCount,
        totalOrderedItems: totalItems,
        completedItems,
        overallPct,
      });
    }

    const summary = {
      totalInDB: dbPOs.length,
      totalInIncoming: incomingPOMap.size,
      matchedInDB: reconciled.length,
      notInDB: notInDB.length,
      dbPOsWithoutIncoming: dbPOs.length - reconciled.length, // 124 PO di DB yang tidak ada di file incoming
      closedPOs: reconciled.filter((r) => r.reconcileStatus === "CLOSED").length,
      partialPOs: reconciled.filter((r) => r.reconcileStatus === "PARTIAL").length,
      pendingPOs: reconciled.filter((r) => r.reconcileStatus === "PENDING").length,
      discrepancyPOs: reconciled.filter((r) => r.discrepancyCount > 0).length,
      fuzzyMatchedCount: reconciled.reduce((acc, po) => acc + po.items.filter((i) => i.matchType === "FUZZY").length, 0),
      unmatchedIncomingCount: reconciled.reduce((acc, po) => acc + (po.unmatchedIncomingItems?.length || 0), 0),
    };

    return NextResponse.json({
      success: true,
      summary,
      reconciled,
      notInDB,
    });
  } catch (err: any) {
    console.error("reconcile-po error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
