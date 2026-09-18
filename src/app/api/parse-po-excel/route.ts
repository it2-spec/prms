import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/utils";

function parseDeliverySchedule(raw: string): { dateStr: string; type: "DATE" | "MONTH" } | null {
  if (!raw) return null;
  // E.g.: "Delivery/Finish (Optional) June, 2026 (Partial Follow Delivery Schedule) to :"
  // or "Delivery/Finish (Optional) Jul 27th, 2026 to :"
  // or "July 23th, 2026"
  const cleaned = raw
    .replace(/Delivery\/Finish\s*(\(Optional\))?/i, "")
    .replace(/to\s*:.*$/i, "")
    .trim();

  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  ];

  // Match specific day e.g. "July 27th, 2026" or "27 July 2026" or "Jul 27th, 2026"
  const dayMatch =
    cleaned.match(/(\b\w+\b)[,\s]+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})/i) ||
    cleaned.match(/(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\b\w+\b)[,\s]+(\d{4})/i);

  if (dayMatch) {
    let mStr = dayMatch[1];
    let dStr = dayMatch[2];
    let yStr = dayMatch[3];
    if (/^\d+$/.test(mStr)) {
      const temp = mStr;
      mStr = dStr;
      dStr = temp;
    }
    const mIdx = monthNames.indexOf(mStr.toLowerCase());
    if (mIdx !== -1) {
      const mNum = (mIdx % 12) + 1;
      const dNum = parseInt(dStr, 10);
      const yNum = parseInt(yStr, 10);
      if (!isNaN(dNum) && !isNaN(yNum) && dNum >= 1 && dNum <= 31) {
        const iso = `${yNum}-${String(mNum).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
        return { dateStr: iso, type: "DATE" };
      }
    }
  }

  // Match month only e.g. "June, 2026" or "June 2026"
  const monthOnlyMatch = cleaned.match(/(\b\w+\b)[,\s]+(\d{4})/i);
  if (monthOnlyMatch) {
    const mStr = monthOnlyMatch[1];
    const yStr = monthOnlyMatch[2];
    const mIdx = monthNames.indexOf(mStr.toLowerCase());
    if (mIdx !== -1) {
      const mNum = (mIdx % 12) + 1;
      const yNum = parseInt(yStr, 10);
      if (!isNaN(yNum)) {
        const iso = `${yNum}-${String(mNum).padStart(2, "0")}`;
        return { dateStr: iso, type: "MONTH" };
      }
    }
  }

  return null;
}

const STOP_WORDS = new Set([
  "opz", "pt", "sri", "no", "color", "clear", "paint", "thinner", "chemical", "black",
  "white", "silver", "grey", "gray", "red", "blue", "type", "pail", "kg", "ltr",
]);

function extractKeyIdentifiers(s: string): string[] {
  const norm = s.toLowerCase().replace(/[^a-z0-9]/g, " ");
  const words = norm.split(/\s+/).filter(Boolean);
  const keys: string[] = [];

  for (const w of words) {
    if (/\d/.test(w) && w.length >= 2) {
      keys.push(w);
    }
  }

  for (let i = 0; i < words.length - 1; i++) {
    const combined = words[i] + words[i + 1];
    if (/\d/.test(combined) && combined.length >= 4) {
      keys.push(combined);
    }
  }

  return Array.from(new Set(keys));
}

function matchDbItem(
  description: string,
  dbItems: Array<{ id: string; name: string; code: string; lastUnitPrice?: any }>
) {
  const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const dClean = clean(description);
  const dNorm = normalizeName(description);

  // 1. Exact match on normalized name
  let found = dbItems.find((i) => normalizeName(i.name) === dNorm);
  if (found) return found;

  // 2. Exact match on item code
  found = dbItems.find((i) => i.code.toLowerCase() === dNorm || clean(i.code) === dClean);
  if (found) return found;

  // 3. Clean string match (ignoring symbols and spacing differences)
  found = dbItems.find((i) => clean(i.name) === dClean);
  if (found) return found;

  // 4. Substring containment (prioritizing longer matching names, min length 6)
  const sortedByLen = [...dbItems].sort((a, b) => b.name.length - a.name.length);
  found = sortedByLen.find((i) => {
    const iClean = clean(i.name);
    return iClean.length >= 6 && (dClean.includes(iClean) || iClean.includes(dClean));
  });
  if (found) return found;

  // 5. Distinctive Key Identifiers (Alphanumeric codes with digits like WW102, CSH18005, AC10705)
  const dKeys = extractKeyIdentifiers(description);
  if (dKeys.length > 0) {
    let bestKeyMatches = 0;
    let bestKeyItem: any = null;
    for (const it of dbItems) {
      const itClean = clean(it.name);
      let matchCount = 0;
      for (const k of dKeys) {
        if (itClean.includes(k)) matchCount++;
      }
      if (matchCount > bestKeyMatches) {
        bestKeyMatches = matchCount;
        bestKeyItem = it;
      }
    }
    if (bestKeyMatches > 0 && bestKeyItem) {
      return bestKeyItem;
    }
  }

  // 6. Word / Token overlap without stop words (only when description has no distinct alphanumeric codes)
  if (dKeys.length === 0) {
    const dTokens = dNorm.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    if (dTokens.length >= 2) {
      let bestScore = 0;
      let bestTokenItem: any = null;
      for (const it of dbItems) {
        const itTokens = normalizeName(it.name).split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
        let matchCount = 0;
        for (const dt of dTokens) {
          if (itTokens.includes(dt)) matchCount++;
        }
        const score = matchCount / Math.max(dTokens.length, itTokens.length);
        if (score >= 0.6 && score > bestScore) {
          bestScore = score;
          bestTokenItem = it;
        }
      }
      if (bestTokenItem) return bestTokenItem;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File Excel wajib diunggah" }, { status: 400 });
    }

    const filename = file.name || "";
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: "Lembar kerja Excel kosong" }, { status: 400 });
    }

    let poNumber: string | null = null;
    let poDate: string | null = null;
    let supplierName: string | null = null;
    let department: string | null = null;
    let purposeProject: string | null = null;
    let rawLocation: string | null = null;
    let deliveryStr: string | null = null;
    let quotationRemarks: string | null = null;

    // 1. Scan Metadata across Header & Remarks (rows 1..65, cols 1..20)
    for (let r = 1; r <= Math.min(worksheet.rowCount, 65); r++) {
      const row = worksheet.getRow(r);
      for (let c = 1; c <= 20; c++) {
        const cell = row.getCell(c);
        const valStr = cell.value ? String(cell.value).trim() : "";
        if (!valStr) continue;
        const valUpper = valStr.toUpperCase();

        // PO Number
        if (valUpper.includes("PO NO") || valUpper.includes("NOMOR PO")) {
          for (const offset of [1, 2, 3, 10]) {
            const valR = row.getCell(c + offset).value;
            if (valR && ![':', ''].includes(String(valR).trim())) {
              poNumber = String(valR).trim();
              break;
            }
          }
          if (!poNumber) {
            const nextRowVal = worksheet.getRow(r + 1).getCell(c).value;
            if (nextRowVal) poNumber = String(nextRowVal).trim();
          }
        }

        // Date
        if (["DATE", "TANGGAL", "DATE :"].includes(valUpper)) {
          for (const offset of [1, 2, 3]) {
            const valR = row.getCell(c + offset).value;
            if (valR && String(valR).trim() !== ":") {
              poDate = String(valR).trim();
              break;
            }
          }
        }

        // Supplier (To)
        if (["TO", "TO :", "SUPPLIER", "PEMASOK"].includes(valUpper)) {
          for (const offset of [1, 2, 3]) {
            const valR = row.getCell(c + offset).value;
            if (valR && ![':', ''].includes(String(valR).trim())) {
              supplierName = String(valR).trim();
              break;
            }
          }
        }

        // USE BY DEPT
        if (valUpper.includes("USE BY DEPT") || valUpper.includes("USE BY DEPARTMENT")) {
          for (let offset = 1; offset <= 6; offset++) {
            const valR = row.getCell(c + offset).value;
            if (valR) {
              const cleaned = String(valR).replace(/^[:\s]+/, "").trim();
              if (cleaned && cleaned !== ":") {
                department = cleaned;
                break;
              }
            }
          }
        }

        // PROPOSE / PROJECT / USAGE FOR
        if (
          valUpper.includes("PROPOSE/PROJECT") ||
          valUpper.includes("PURPOSE/PROJECT") ||
          valUpper.includes("USAGE FOR") ||
          valUpper.includes("PROPOSAL/PROJECT")
        ) {
          for (let offset = 1; offset <= 6; offset++) {
            const valR = row.getCell(c + offset).value;
            if (valR) {
              const cleaned = String(valR).replace(/^[:\s]+/, "").trim();
              if (cleaned && cleaned !== ":") {
                purposeProject = cleaned;
                break;
              }
            }
          }
        }

        // DELIVERY / FINISH
        if (valUpper.includes("DELIVERY/FINISH") || valUpper.includes("DELIVERY / FINISH")) {
          deliveryStr = valStr;
        }

        // QUOTATION / REMARKS (Price As per Your Quotations)
        if (valUpper.includes("PRICE AS PER YOUR QUOTATION")) {
          const m = valStr.match(/Price As per Your Quotations?\s*[:\s]*(.*)/i);
          if (m && m[1]) quotationRemarks = m[1].trim();
          else quotationRemarks = valStr.replace(/^1\.?\s*/, "").trim();
        }

        // LOCATION / WAREHOUSE
        if (
          valUpper.includes("PLANT 1") ||
          valUpper.includes("PLANT 2") ||
          valUpper.includes("PRODUCTION PREPARATION")
        ) {
          if (!rawLocation) rawLocation = valStr;
        }
      }
    }

    // Fallback PO Number from filename if not extracted
    if (!poNumber && filename) {
      const m = filename.match(/(\d{3,4}[-/]\w+[-/]\w+[-/]\w+[-/]\d{4})/i);
      if (m) {
        poNumber = m[1].replace(/-/g, "/");
      }
    }

    // 2. Locate Header Row (rows 1..30)
    let headerRowIdx = -1;
    for (let r = 1; r <= 30; r++) {
      const row = worksheet.getRow(r);
      let foundDesc = false;
      for (let c = 1; c <= 25; c++) {
        const v = String(row.getCell(c).value || "").trim().toUpperCase();
        if (["DESCRIPTIONS", "DESCRIPTION", "NAMA BARANG"].includes(v)) {
          foundDesc = true;
          break;
        }
      }
      if (foundDesc) {
        headerRowIdx = r;
        break;
      }
    }

    const colMap: Record<string, number> = {};
    if (headerRowIdx !== -1) {
      const headerRow = worksheet.getRow(headerRowIdx);
      const prevRow = headerRowIdx > 1 ? worksheet.getRow(headerRowIdx - 1) : null;
      const nextRow = worksheet.getRow(headerRowIdx + 1);

      const qtyCols: number[] = [];
      const unitCols: number[] = [];

      for (let c = 1; c <= 25; c++) {
        const v1 = String(headerRow.getCell(c).value || "").trim().toUpperCase();
        const v0 = prevRow ? String(prevRow.getCell(c).value || "").trim().toUpperCase() : "";
        const v2 = String(nextRow.getCell(c).value || "").trim().toUpperCase();
        const combined = `${v0} ${v1} ${v2}`;

        if (v1 === "NO" && !colMap.NO) colMap.NO = c;
        if ((combined.includes("DESCRIPTION") || combined.includes("NAMA BARANG")) && !colMap.DESCRIPTIONS) colMap.DESCRIPTIONS = c;
        if ((combined.includes("PACKAGE") || combined.includes("KEMASAN") || combined.includes("SPECIFICATION")) && !colMap.PACKAGE) colMap.PACKAGE = c;
        if ((combined.includes("UNIT PRICE") || combined.includes("HARGA") || combined.includes("PRICE")) && !colMap["UNIT PRICE"]) colMap["UNIT PRICE"] = c;
        if ((combined.includes("AMOUNT") || combined.includes("TOTAL PRICE") || combined.includes("JUMLAH")) && !colMap.AMOUNT && !combined.includes("SUB TOTAL")) colMap.AMOUNT = c;

        if (combined.includes("QTY") || combined.includes("QUANTITY") || combined.includes("ORDER")) qtyCols.push(c);
        if (combined.includes("UNIT") || combined.includes("SATUAN")) unitCols.push(c);
      }

      const hasPackage = Boolean(colMap.PACKAGE);
      if (hasPackage && qtyCols.length >= 2) {
        colMap.QTY_1 = qtyCols[0];
        colMap.QTY_2 = qtyCols[1];
        if (unitCols.length >= 1) colMap.UNIT_1 = unitCols[0];
        if (unitCols.length >= 2) colMap.UNIT_2 = unitCols[1];
      } else {
        if (qtyCols.length >= 1) colMap.QTY_1 = qtyCols[0];
        if (unitCols.length >= 1) colMap.UNIT_1 = unitCols[0];
      }
    }

    const cleanCell = (val: any) => {
      if (val === null || val === undefined) return null;
      if (typeof val === "object" && val.result !== undefined) val = val.result;
      const s = String(val).trim();
      if (["QTY", "TOTAL", "REMARK", "NOTES", "FORECAST", "STOCK", "SUB TOTAL", "-", "QTY."].includes(s.toUpperCase())) {
        return null;
      }
      return s;
    };

    const extractedItems: { description: string; qty: number; unitPrice: number }[] = [];
    if (headerRowIdx !== -1 && colMap.DESCRIPTIONS) {
      const descCol = colMap.DESCRIPTIONS;
      const qtyCol = colMap.QTY_1 || colMap.QTY_2;
      const priceCol = colMap["UNIT PRICE"];

      for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);

        // Stop condition: Check if row is a footer row
        let isFooter = false;
        for (let c = 1; c <= 15; c++) {
          const cv = String(row.getCell(c).value || "").trim().toUpperCase();
          if (
            cv.includes("SUB TOTAL") ||
            cv.includes("SUBTOTAL") ||
            cv === "TOTAL" ||
            cv.includes("USE BY DEPT") ||
            cv.includes("PROPOSE/PROJECT") ||
            cv.includes("USAGE FOR") ||
            cv.includes("REMARKS:") ||
            cv.includes("DELIVERY/FINISH") ||
            cv.includes("TERMS OF PAYMENT") ||
            cv.includes("TERM OF PAYMENT")
          ) {
            isFooter = true;
            break;
          }
        }
        if (isFooter) break;

        const descVal = cleanCell(row.getCell(descCol).value);
        if (!descVal) continue;

        let qty = 0;
        if (qtyCol) {
          const rawQty = cleanCell(row.getCell(qtyCol).value);
          if (rawQty) {
            const parsedQty = parseFloat(rawQty.replace(/,/g, ""));
            if (!isNaN(parsedQty)) qty = parsedQty;
          }
        }

        // Hanya masukkan item yang nilai pemesanannya (Qty) lebih dari 0
        if (qty <= 0) continue;

        let unitPrice = 0;
        if (priceCol) {
          const rawPrice = cleanCell(row.getCell(priceCol).value);
          if (rawPrice) {
            const parsedPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
            if (!isNaN(parsedPrice)) unitPrice = parsedPrice;
          }
        }

        extractedItems.push({ description: descVal, qty, unitPrice });
      }
    }

    // Match Supplier in Database
    const suppliers = await prisma.supplier.findMany({ where: { isActive: true } });
    let matchedSupplierId = "";
    if (supplierName) {
      const supLower = supplierName.toLowerCase();
      const matchedSup = suppliers.find(
        (s) => s.name.toLowerCase().includes(supLower) || supLower.includes(s.name.toLowerCase())
      );
      if (matchedSup) matchedSupplierId = matchedSup.id;
    }

    // Match Warehouse in Database
    const warehouses = await prisma.warehouse.findMany({ where: { isActive: true } });
    let matchedWarehouseId = "";
    let warehouseName = "";
    const locSearchStr = `${rawLocation || ""} ${department || ""} ${deliveryStr || ""} ${purposeProject || ""} ${filename}`.toUpperCase();

    const matchedWh = warehouses.find((w) => {
      const wUpper = w.name.toUpperCase();
      const wCode = w.code.toUpperCase();
      if (locSearchStr.includes("PLANT 1") && (wUpper.includes("PLANT 1") || wCode.includes("PLANT1"))) return true;
      if (locSearchStr.includes("PLANT 2") && (wUpper.includes("PLANT 2") || wCode.includes("PLANT2"))) return true;
      if (locSearchStr.includes("PREPARATION") && (wUpper.includes("PREPARATION") || wCode.includes("PREP"))) return true;
      if (locSearchStr.includes("PUSAT") && (wUpper.includes("PUSAT") || wCode.includes("WH001"))) return true;
      if (locSearchStr.includes("CABANG") && (wUpper.includes("CABANG") || wCode.includes("WH002"))) return true;
      return false;
    });

    if (matchedWh) {
      matchedWarehouseId = matchedWh.id;
      warehouseName = matchedWh.name;
    } else if (warehouses.length > 0) {
      // Default to Plant 1 if not specified
      const p1 = warehouses.find((w) => w.name.toUpperCase().includes("PLANT 1"));
      if (p1) {
        matchedWarehouseId = p1.id;
        warehouseName = p1.name;
      }
    }

    // Parse Expected Delivery Schedule & Delivery Date Type
    const parsedDelivery = deliveryStr ? parseDeliverySchedule(deliveryStr) : null;
    const expectedDelivery = parsedDelivery ? parsedDelivery.dateStr : null;
    const deliveryDateType = parsedDelivery ? parsedDelivery.type : "DATE";

    // Match Items in Database with Smart Match
    const dbItems = await prisma.item.findMany({ where: { isActive: true } });
    const matchedRows = extractedItems.map((extracted) => {
      const matchedItem = matchDbItem(extracted.description, dbItems);

      return {
        itemId: matchedItem ? matchedItem.id : "",
        description: extracted.description,
        qty: extracted.qty,
        unitPrice: extracted.unitPrice > 0 ? extracted.unitPrice : (matchedItem?.lastUnitPrice ? Number(matchedItem.lastUnitPrice) : 0),
        isMatched: Boolean(matchedItem),
      };
    });

    return NextResponse.json({
      success: true,
      poNumber,
      poDate,
      supplierName,
      matchedSupplierId,
      matchedWarehouseId,
      warehouseName,
      department,
      purposeProject,
      notes: quotationRemarks,
      expectedDelivery,
      deliveryDateType,
      items: matchedRows,
    });
  } catch (error: any) {
    console.error("Excel parse error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengolah file Excel PO" }, { status: 500 });
  }
}
