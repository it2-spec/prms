import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { normalizeName } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

type ParsedDelivery = {
  suratJalan: string;
  poNumber: string;
  supplierName: string;
  shipDate: string; // ISO date string (from RECEIVE DATE as proxy)
  receiveDate: string; // ISO date string
  items: ParsedItem[];
  // Resolved from DB
  poId: string | null;
  poFound: boolean;
  supplierId: string | null;
  warehouseId: string | null;
  alreadyImported: boolean;
  warnings: string[];
};

type ParsedItem = {
  keyItem: string;
  lineNo: number;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  // Resolved
  poDetailId: string | null;
  itemId: string | null;
  itemName: string | null;
};

function parseExcelDate(val: ExcelJS.CellValue): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    return d;
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Normalize PO number untuk matching yang fleksibel.
 * incoming.xlsx menggunakan format "001/PA/CS/I/2026"
 * Database mungkin menyimpan format yang sama karena sudah dinormalisasi saat upload PO.
 */
function normalizePONumber(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    // Read Excel
    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer as any);
    const ws = wb.worksheets[0];

    // ── Deteksi header row dan kolom mapping ─────────────────────────────────
    // incoming.xlsx struktur aktual:
    //   C1: PO NO, C2: DESCRIPTIONS, C3: QTY, C4: UNIT, C5: SUPPLIER,
    //   C6: DATE_PO, C7: RECEIVED QTY, C8: NO SURAT JALAN, C9: RECEIVE DATE
    //
    // Kita deteksi header secara dinamis agar tahan perubahan format
    let headerRow = 1;
    let colPONo = 1, colDesc = 2, colQty = 3, colUnit = 4, colSupplier = 5;
    let colDatePO = 6, colReceivedQty = 7, colSuratJalan = 8, colReceiveDate = 9;

    // Scan baris 1-5 untuk temukan header
    ws.eachRow((row, rn) => {
      if (rn > 5) return;
      for (let c = 1; c <= 20; c++) {
        const v = String(row.getCell(c).value ?? "").trim().toUpperCase();
        if (v === "PO NO" || v === "PO NUMBER" || v === "NOMOR PO") {
          headerRow = rn;
          colPONo = c;
        } else if ((v === "DESCRIPTIONS" || v === "DESCRIPTION" || v === "DESCRIPTIONS") && rn === headerRow) {
          colDesc = c;
        } else if ((v === "QTY" || v === "QUANTITY") && rn === headerRow) {
          colQty = c;
        } else if ((v === "UNIT" || v === "SATUAN") && rn === headerRow) {
          colUnit = c;
        } else if ((v === "SUPPLIER" || v === "PEMASOK") && rn === headerRow) {
          colSupplier = c;
        } else if (v === "DATE_PO" && rn === headerRow) {
          colDatePO = c;
        } else if ((v === "RECEIVED QTY" || v === "RECEIVE QTY" || v === "QTY RECEIVED") && rn === headerRow) {
          colReceivedQty = c;
        } else if ((v.includes("SURAT JALAN") || v === "NO SJ" || v === "DELIVERY NOTE") && rn === headerRow) {
          colSuratJalan = c;
        } else if ((v === "RECEIVE DATE" || v === "RECEIVED DATE" || v === "TGL RECEIVE" || v === "TGL TERIMA") && rn === headerRow) {
          colReceiveDate = c;
        }
      }
    });

    // Group rows by Surat Jalan
    const groupedBySJ = new Map<string, {
      poNumber: string;
      supplierName: string;
      receiveDate: Date | null;
      items: Array<{
        keyItem: string;
        lineNo: number;
        description: string;
        qty: number;
        unit: string;
        unitPrice: number;
      }>;
    }>();

    ws.eachRow((row, rn) => {
      if (rn <= headerRow) return; // skip header

      const poNo = String(row.getCell(colPONo).value ?? "").trim();
      if (!poNo) return;

      const keyItem  = String(row.getCell(colDesc).value ?? "").trim();
      const desc     = keyItem; // description sama dengan keyItem
      const qty      = Number(row.getCell(colQty).value) || 0;
      const unit     = String(row.getCell(colUnit).value ?? "").trim();
      const unitPrice = 0; // incoming tidak punya unit price kolom tersendiri
      const supplier = String(row.getCell(colSupplier).value ?? "").trim();
      const sj       = String(row.getCell(colSuratJalan).value ?? "").trim();
      const recvRaw  = row.getCell(colReceiveDate).value;
      const lineNo   = rn - headerRow; // nomor urut item dalam file

      if (!sj) return;

      const receiveDate = parseExcelDate(recvRaw);

      if (!groupedBySJ.has(sj)) {
        groupedBySJ.set(sj, {
          poNumber: poNo,
          supplierName: supplier,
          receiveDate,
          items: [],
        });
      }

      groupedBySJ.get(sj)!.items.push({
        keyItem,
        lineNo,
        description: desc,
        qty,
        unit,
        unitPrice,
      });
    });

    // Bulk-fetch all POs from DB that are mentioned
    // incoming menggunakan format "001/PA/CS/I/2026"
    // DB menyimpan format yang sama (sudah dinormalisasi saat upload PO)
    const allPoNumbersRaw = [...new Set([...groupedBySJ.values()].map((g) => g.poNumber))];

    // Buat lookup map: normalized PO number → actual PO number in file
    // karena format mungkin sedikit beda (case, spasi, dll)
    const dbPOs = await prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true } },
        warehouse: { select: { id: true } },
        details: {
          include: { item: { select: { id: true, name: true, unit: true, packageUnit: true, packageSize: true } } },
          orderBy: { id: "asc" },
        },
      },
    });

    // Build PO lookup: normalized PO number → PO record
    const poMapNorm = new Map(dbPOs.map((po) => [normalizePONumber(po.poNumber), po]));

    // Check which surat jalans already exist in DB
    const allSuratJalans = [...groupedBySJ.keys()];
    const existingSJs = await prisma.delivery.findMany({
      where: { suratJalan: { in: allSuratJalans } },
      select: { suratJalan: true },
    });
    const existingSJSet = new Set(existingSJs.map((d) => d.suratJalan));

    // Build parsed result
    const result: ParsedDelivery[] = [];

    for (const [sj, group] of groupedBySJ) {
      const warnings: string[] = [];
      const poNormKey = normalizePONumber(group.poNumber);
      const po = poMapNorm.get(poNormKey);
      const alreadyImported = existingSJSet.has(sj);

      const parsedItems: ParsedItem[] = group.items.map((item, idx) => {
        let poDetailId: string | null = null;
        let itemId: string | null = null;
        let itemName: string | null = null;

        if (po) {
          // ── Strategi matching item ───────────────────────────────────────────
          // 1. Coba match berdasarkan urutan (index) — paling reliable jika order sama
          const byIndex = po.details[idx];

          // 2. Fuzzy match berdasarkan nama item (case-insensitive substring)
          const descNorm = normalizeName(item.description);
          const fuzzy = po.details.find((d) => {
            const dn = normalizeName(d.item.name);
            return dn === descNorm ||
              dn.includes(descNorm) ||
              descNorm.includes(dn) ||
              // handle typo minor: first 8 chars match
              (descNorm.length >= 8 && dn.length >= 8 && descNorm.substring(0, 8) === dn.substring(0, 8));
          });

          // Prioritas: fuzzy match lebih reliable karena nama item bisa typo minor
          if (fuzzy) {
            poDetailId = fuzzy.id;
            itemId = fuzzy.itemId;
            itemName = fuzzy.item.name;
            if (fuzzy !== byIndex) {
              warnings.push(`Item "${item.description}" matched via nama fuzzy → "${fuzzy.item.name}"`);
            }
          } else if (byIndex) {
            // Fallback ke urutan jika fuzzy gagal
            poDetailId = byIndex.id;
            itemId = byIndex.itemId;
            itemName = byIndex.item.name;
            warnings.push(`Item "${item.description}" matched via urutan baris (index ${idx + 1}) → "${byIndex.item.name}"`);
          } else {
            warnings.push(`Item "${item.description}" tidak ditemukan di PO "${group.poNumber}"`);
          }
        }

        return {
          ...item,
          poDetailId,
          itemId,
          itemName,
        };
      });

      if (!po) {
        warnings.push(`PO "${group.poNumber}" tidak ditemukan di database`);
      }

      const receiveIso = group.receiveDate?.toISOString() ?? new Date().toISOString();

      result.push({
        suratJalan: sj,
        poNumber: group.poNumber,
        supplierName: group.supplierName,
        shipDate: receiveIso, // use receive date as ship date (historical)
        receiveDate: receiveIso,
        items: parsedItems,
        poId: po?.id ?? null,
        poFound: !!po,
        supplierId: po?.supplierId ?? null,
        warehouseId: po?.warehouseId ?? null,
        alreadyImported,
        warnings,
      });
    }

    return NextResponse.json({
      total: result.length,
      matched: result.filter((r) => r.poFound && !r.alreadyImported).length,
      alreadyImported: result.filter((r) => r.alreadyImported).length,
      noPoMatch: result.filter((r) => !r.poFound).length,
      deliveries: result,
    });
  } catch (err: any) {
    console.error("parse-incoming error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
