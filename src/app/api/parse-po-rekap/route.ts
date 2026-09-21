import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/utils";

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function getRawCellValue(worksheet: ExcelJS.Worksheet, r: number, c: number): any {
  const cell = worksheet.getRow(r).getCell(c);
  let v = cell.value;
  // Unwrap formula result if present on this cell
  if (v && typeof v === "object" && "result" in (v as any)) {
    return (v as any).result;
  }
  // If it's a shared formula follower without its own precalculated result, return null/undefined (do not copy master cell)
  if (v && typeof v === "object" && "sharedFormula" in (v as any)) {
    return null;
  }
  return v;
}

function getCellStr(worksheet: ExcelJS.Worksheet, r: number, c: number): string {
  const v = getRawCellValue(worksheet, r, c);
  return v !== null && v !== undefined ? String(v).trim() : "";
}

/**
 * Port of get_smart_cell_value:
 * - If cell has a currency prefix (Rp, IDR, $) → read value from next column
 * - If cell is empty (merged) → read from next column
 */
function getSmartCellValue(
  worksheet: ExcelJS.Worksheet,
  r: number,
  colIdx: number | undefined
): string | number | null {
  if (!colIdx || colIdx < 1 || colIdx > 30) return null;

  const raw = getRawCellValue(worksheet, r, colIdx);
  const valStr = raw !== null && raw !== undefined ? String(raw).trim() : "";
  const valUpper = valStr.toUpperCase();

  // Case 1: currency prefix only → grab next column
  if (
    ["RP", "RP.", "IDR", "$", "USD"].includes(valUpper) ||
    (valUpper.startsWith("RP") && valStr.length <= 5)
  ) {
    const nextRaw = getRawCellValue(worksheet, r, colIdx + 1);
    if (nextRaw !== null && nextRaw !== undefined && String(nextRaw).trim() !== "") {
      const nextStr = String(nextRaw).trim();
      const num = parseFloat(nextStr.replace(/,/g, ""));
      if (!isNaN(num)) return num;
      return `${valStr} ${nextStr}`.trim();
    }
  }

  // Case 2: empty cell (merged) → try next column
  if (raw === null || raw === undefined || valStr === "") {
    const nextRaw = getRawCellValue(worksheet, r, colIdx + 1);
    if (nextRaw !== null && nextRaw !== undefined && String(nextRaw).trim() !== "") {
      return nextRaw as any;
    }
    return null;
  }

  return raw as any;
}

function parseDeliverySchedule(raw: string): { dateStr: string; type: "DATE" | "MONTH" } | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/Delivery\/Finish\s*(\(Optional\))?/i, "")
    .replace(/to\s*:.*$/i, "")
    .trim();

  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  ];

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

  const dateSlashMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dateSlashMatch) {
    const d1 = parseInt(dateSlashMatch[1], 10);
    const d2 = parseInt(dateSlashMatch[2], 10);
    const yr = parseInt(dateSlashMatch[3], 10);
    let day = d1;
    let mon = d2;
    if (d1 <= 12 && d2 > 12) {
      day = d2;
      mon = d1;
    }
    const iso = `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { dateStr: iso, type: "DATE" };
  }

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

/** Port of clean_value */
function cleanValue(val: any, isQty = false): string | number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  const SKIP = ["QTY", "TOTAL", "REMARK", "NOTES", "FORECAST", "STOCK", "SUB TOTAL", "-", "QTY."];
  if (SKIP.includes(s.toUpperCase())) return isQty ? null : s;
  if (isQty) {
    const f = parseFloat(s.replace(/,/g, ""));
    if (!isNaN(f)) return Number.isInteger(f) ? f : f;
    return null;
  }
  return val;
}

/** Check cells in row up to maxCol contain SUB TOTAL (limited to main data area) */
function rowHasSubTotal(worksheet: ExcelJS.Worksheet, r: number, maxCol = 15): boolean {
  for (let c = 1; c <= maxCol; c++) {
    const v = getCellStr(worksheet, r, c).toUpperCase();
    if (v.includes("SUB TOTAL") || v === "SUBTOTAL") return true;
  }
  return false;
}

/** Normalize raw location string to standard Warehouse name */
function normalizeWarehouseName(raw: string): string {
  const up = (raw || "").toUpperCase();
  if (up.includes("PLANT 1")) return "Painting Plant 1 Area";
  if (up.includes("PLANT 2")) return "Painting Plant 2 Area";
  if (up.includes("PRODUCTION PREPARATION")) return "Production Preparation Area";
  return "Painting Plant 1 Area";
}

/**
 * Parse info konversi dari kolom PACKAGE, e.g.:
 *   "1 pail = 16 kg"  → { packageUnit: "pail", packageSize: 16, baseUnit: "kg" }
 *   "1 can = 20 ltr"  → { packageUnit: "can",  packageSize: 20, baseUnit: "ltr" }
 *   "1 pail = 20ltr"  → { packageUnit: "pail", packageSize: 20, baseUnit: "ltr" }
 * Returns null jika tidak bisa diparse.
 */
function parsePackageInfo(raw: string): {
  packageUnit: string;
  packageSize: number;
  baseUnit: string;
} | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  // Pattern: "1 <pkgUnit> = <size> <baseUnit>"  (with optional spaces around '=')
  const m = s.match(
    /^1\s*(pail|can|drum|galon|gallon|bucket|pack|box|pcs)\s*[=:]\s*([\d.]+)\s*(kg|kgs|ltr?|liter|l|ml|gr|gram)s?/i
  );
  if (!m) return null;
  const packageUnit = m[1].toLowerCase();
  const packageSize = parseFloat(m[2]);
  let baseUnit = m[3].toLowerCase();
  // Normalize base unit aliases
  if (baseUnit === "lt" || baseUnit === "liter" || baseUnit === "liters") baseUnit = "ltr";
  if (baseUnit === "kgs") baseUnit = "kg";
  if (!isNaN(packageSize) && packageSize > 0) {
    return { packageUnit, packageSize, baseUnit };
  }
  return null;
}

/**
 * Normalize PO number format:
 * - Remove accidental missing slash e.g. "0252/SRI/PUD/II2026" → "0252/SRI/PUD/II/2026"
 * - Attempt to fix wrong month names (won't change actual number from filename)
 */
function normalizePONumber(raw: string): string {
  if (!raw) return raw;
  // Fix missing slash before 4-digit year: e.g. "II2026" → "II/2026"
  return raw.replace(/([A-Z])(\d{4})$/, "$1/$2").trim();
}

/**
 * Extract PO number from Excel filename as fallback.
 * e.g. "0252-SRI-PUD-II-2026 (PT. Shinanoa Indonesia)..." → "0252/SRI/PUD/II/2026"
 */
function poNumberFromFilename(filename: string): string | null {
  // Match leading pattern like "001-PA-CS-I-2026" or "0031-SRI-PUD-I-2026"
  const m = filename.match(/^(\w+(?:-\w+){3,4})-\d{4}/);
  if (!m) return null;
  // e.g. "001-PA-CS-I-2026" → parts up to year
  const yearMatch = filename.match(/^([\w-]+-\d{4})/);
  if (!yearMatch) return null;
  // Split by dash and reconstruct with slash: "001-PA-CS-I-2026" → "001/PA/CS/I/2026"
  const parts = yearMatch[1].split("-");
  return parts.join("/");
}

// ─── Per-sheet extractor ──────────────────────────────────────────────────────

function extractPoDataFromSheet(
  worksheet: ExcelJS.Worksheet,
  fallbackFilename?: string
): {
  poNumber: string;
  poDate: string;
  supplier: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierContactPerson: string;
  warehouseName: string;
  department: string;
  purposeProject: string;
  expectedDelivery: string | null;
  deliveryDateType: "DATE" | "MONTH";
  notes: string;
  items: {
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    packageQty: number | null;
    packageUnit: string | null;
    packageSize: number | null;
  }[];
} {
  let poNumber = "";
  let poDate = "";
  let supplier = "";
  let supplierAddress = "";
  let supplierPhone = "";
  let supplierContactPerson = "";
  let rawLocation = "";
  let department = "";
  let purposeProject = "";
  let deliveryStr = "";
  let notes = "";

  // ── 1. Extract Metadata: rows 1–50, cols 1–18 ─────────────────────────────
  for (let r = 1; r <= 50; r++) {
    for (let c = 1; c <= 18; c++) {
      const raw = getRawCellValue(worksheet, r, c);
      if (!raw || typeof raw !== "string") continue;
      const valUpper = raw.trim().toUpperCase();

      // PO NO
      if (!poNumber && (valUpper.includes("PO NO") || valUpper.includes("NOMOR PO"))) {
        for (const offset of [1, 2, 3, 10]) {
          const v = getCellStr(worksheet, r, c + offset);
          if (v && ![":", ""].includes(v)) {
            poNumber = v;
            break;
          }
        }
        if (!poNumber) {
          for (let rr = r + 1; rr <= r + 3; rr++) {
            for (const offset of [0, 1, 2]) {
              const v = getCellStr(worksheet, rr, c + offset);
              if (v && ![":", ""].includes(v)) {
                poNumber = v;
                break;
              }
            }
            if (poNumber) break;
          }
        }
      }

      // DATE
      if (!poDate && ["DATE", "TANGGAL", "DATE :"].includes(valUpper)) {
        for (const offset of [1, 2, 3]) {
          const rawNext = getRawCellValue(worksheet, r, c + offset);
          const nextStr = rawNext !== null && rawNext !== undefined ? String(rawNext).trim() : "";
          if (!nextStr || nextStr === ":") continue;
          if (rawNext instanceof Date) {
            poDate = rawNext.toISOString().split("T")[0];
          } else if (typeof rawNext === "number") {
            const d = new Date(Math.round((rawNext - 25569) * 86400 * 1000));
            poDate = d.toISOString().split("T")[0];
          } else {
            try {
              const parsed = new Date(nextStr);
              poDate = isNaN(parsed.getTime()) ? nextStr : parsed.toISOString().split("T")[0];
            } catch {
              poDate = nextStr;
            }
          }
          break;
        }
      }

      // SUPPLIER (To) & Address / Phone
      if (!supplier && ["TO", "TO :", "SUPPLIER", "PEMASOK"].includes(valUpper)) {
        let supCol = c;
        for (const offset of [1, 2, 3]) {
          const v = getCellStr(worksheet, r, c + offset);
          if (v && ![":", ""].includes(v)) {
            supplier = v;
            supCol = c + offset;
            break;
          }
        }

        // Collect address lines & phone below supplier name
        const addrLines: string[] = [];
        for (let rr = r + 1; rr <= r + 5; rr++) {
          const lineVal = getCellStr(worksheet, rr, supCol);
          if (!lineVal) break;
          const lineUp = lineVal.toUpperCase();
          if (lineUp.includes("PHONE") || lineUp.includes("TELP") || lineUp.includes("FAX") || lineUp.includes("ATTN") || lineUp.includes("DATE")) {
            if (!supplierPhone && (lineUp.includes("PHONE") || lineUp.includes("TELP"))) {
              const cleaned = lineVal.replace(/^(PHONE|TELP)\s*:\s*/i, "").trim();
              supplierPhone = cleaned.split(/[,/(\sFax]/i)[0].trim();
            }
            break;
          }
          addrLines.push(lineVal);
        }
        if (addrLines.length > 0) supplierAddress = addrLines.join(", ");
      }

      // CONTACT PERSON (Attn)
      if (!supplierContactPerson && ["ATTN", "ATTN :", "CONTACT", "UP", "UP :"].includes(valUpper)) {
        for (const offset of [1, 2, 3]) {
          const cp = getCellStr(worksheet, r, c + offset);
          if (cp && ![":", ""].includes(cp)) {
            supplierContactPerson = cp;
            break;
          }
        }
      }

      // DEPARTMENT (Use by Dept)
      if (!department && (valUpper.includes("USE BY DEPT") || valUpper.includes("USE BY DEPARTMENT"))) {
        for (const offset of [1, 2, 3]) {
          const v = getCellStr(worksheet, r, c + offset);
          if (v && ![":", ""].includes(v)) {
            department = v.replace(/^:\s*/, "").trim();
            break;
          }
        }
      }

      // PURPOSE / PROJECT (Propose/Project)
      if (!purposeProject && (valUpper.includes("PROPOSE/PROJECT") || valUpper.includes("PURPOSE/PROJECT") || valUpper.includes("PROJECT"))) {
        for (const offset of [1, 2, 3, 4]) {
          const v = getCellStr(worksheet, r, c + offset);
          if (v && ![":", ""].includes(v)) {
            purposeProject = v.replace(/^:\s*/, "").trim();
            break;
          }
        }
      }

      // LOCATION / WAREHOUSE
      if (!rawLocation && (valUpper.includes("PLANT 1") || valUpper.includes("PLANT 2") || valUpper.includes("PRODUCTION PREPARATION"))) {
        rawLocation = valUpper;
      }
    }
  }

  // Scan extra fallback for Location/Warehouse across all sheet rows
  if (!rawLocation) {
    for (let r = 1; r <= Math.min(worksheet.rowCount, 80); r++) {
      for (let c = 1; c <= 15; c++) {
        const v = getCellStr(worksheet, r, c).toUpperCase();
        if (v.includes("PLANT 1") || v.includes("PLANT 2") || v.includes("PRODUCTION PREPARATION")) {
          rawLocation = v;
          break;
        }
      }
      if (rawLocation) break;
    }
  }

  const warehouseName = normalizeWarehouseName(rawLocation);

  // ── Normalize & Fallback PO Number ────────────────────────────────────────
  // 1. Try to normalize the extracted PO number (fix typos like missing slash)
  if (poNumber) {
    poNumber = normalizePONumber(poNumber);
  }
  // 2. If PO number still looks wrong or empty, use filename-derived PO number
  if (fallbackFilename) {
    const fnPo = poNumberFromFilename(fallbackFilename);
    if (fnPo) {
      // Use filename as authoritative source if:
      //   a) No PO number extracted from content
      //   b) Extracted PO doesn't match expected pattern (no slash / too short)
      const looksValid = /^\w+\/\w+\/\w+\/\w+\/\d{4}$/.test(poNumber);
      if (!poNumber || !looksValid) {
        poNumber = fnPo;
      }
    }
  }

  // ── 2. Dynamic Header Row (rows 1–30) ─────────────────────────────────────
  let headerRow = -1;
  for (let r = 1; r <= 30; r++) {
    for (let c = 1; c <= 25; c++) {
      const v = getCellStr(worksheet, r, c).toUpperCase();
      if (["DESCRIPTIONS", "DESCRIPTION", "NAMA BARANG"].includes(v)) {
        headerRow = r;
        break;
      }
    }
    if (headerRow !== -1) break;
  }

  if (headerRow === -1) {
    return {
      poNumber,
      poDate,
      supplier,
      supplierAddress,
      supplierPhone,
      supplierContactPerson,
      warehouseName,
      department,
      purposeProject,
      expectedDelivery: null,
      deliveryDateType: "DATE" as const,
      notes: "",
      items: [],
    };
  }

  const headers: Record<number, { main: string; combined: string }> = {};
  for (let c = 1; c <= 25; c++) {
    const v1 = getCellStr(worksheet, headerRow, c);
    const v0 = headerRow > 1 ? getCellStr(worksheet, headerRow - 1, c) : "";
    const v2 = getCellStr(worksheet, headerRow + 1, c);
    const combined = [v0, v1, v2].filter(Boolean).join(" ").toUpperCase();
    headers[c] = { main: v1.toUpperCase(), combined };
  }

  const colMap: Record<string, number | undefined> = {};

  for (const [cStr, h] of Object.entries(headers)) {
    const c = Number(cStr);
    const { main: m, combined: cb } = h;
    if (m === "NO" && !colMap.NO) colMap.NO = c;
    else if ((cb.includes("DESCRIPTION") || cb.includes("NAMA BARANG")) && !colMap.DESCRIPTIONS)
      colMap.DESCRIPTIONS = c;
    else if ((cb.includes("PACKAGE") || cb.includes("KEMASAN")) && !colMap.PACKAGE)
      colMap.PACKAGE = c;
    else if ((cb.includes("SPECIFICATION") || cb.includes("SPESIFIKASI")) && !colMap.SPECIFICATION)
      colMap.SPECIFICATION = c;
    else if (
      (cb.includes("UNIT PRICE") || cb.includes("HARGA SATUAN") || (cb.includes("PRICE") && !cb.includes("TOTAL PRICE"))) &&
      !colMap["UNIT PRICE"]
    )
      colMap["UNIT PRICE"] = c;
    else if (
      (cb.includes("AMOUNT") || cb.includes("TOTAL PRICE") || cb.includes("JUMLAH")) &&
      !colMap.AMOUNT &&
      !cb.includes("SUB TOTAL")
    )
      colMap.AMOUNT = c;
  }

  if (!colMap.PACKAGE && colMap.SPECIFICATION) {
    colMap.PACKAGE = colMap.SPECIFICATION;
  }

  const descColIdx = colMap.DESCRIPTIONS ?? 1;
  const priceColIdx = colMap["UNIT PRICE"] ?? 25;

  // ── Klasifikasi QTY/UNIT berbasis DATA (bukan header) ──────────────────────
  const PACKAGE_UNITS = ["PAIL", "CAN", "DRUM", "GALON", "GALLON", "BUCKET", "PACK", "BOX", "PCS", "PIEC", "BOTOL", "TUBE"];
  const BASE_UNITS = ["KG", "KGS", "LT", "LTR", "LITER", "L", "ML", "GR", "GRM", "GRAM"];

  const scanRows = Math.min(15, worksheet.rowCount - headerRow);
  const colStats: Record<number, { numeric: number; text: number }> = {};
  for (let c = descColIdx + 1; c < priceColIdx; c++) {
    const hStr = (headers[c]?.combined || "").toUpperCase();
    if (hStr.includes("PACKAGE") || hStr.includes("KEMASAN")) continue;
    colStats[c] = { numeric: 0, text: 0 };
  }
  for (let i = 1; i <= scanRows; i++) {
    const r = headerRow + i;
    if (r > worksheet.rowCount) break;
    for (let c = descColIdx + 1; c < priceColIdx; c++) {
      if (!colStats[c]) continue;
      const raw = getRawCellValue(worksheet, r, c);
      if (raw === null || raw === undefined) continue;
      if (typeof raw === "object") {
        colStats[c].numeric++;
        continue;
      }
      const s = String(raw).trim();
      if (!s || s.toUpperCase() === "NULL") continue;
      const n = parseFloat(s.replace(/,/g, ""));
      if (!isNaN(n) && /^[\d.,-]+$/.test(s)) {
        colStats[c].numeric++;
      } else if (s.length <= 12) {
        colStats[c].text++;
      }
    }
  }

  const allCols: { type: "qty" | "unit"; col: number }[] = [];
  for (let c = descColIdx + 1; c < priceColIdx; c++) {
    const st = colStats[c];
    if (!st) continue;
    if (st.numeric === 0 && st.text === 0) continue;
    if (st.numeric >= st.text && st.numeric > 0) {
      allCols.push({ type: "qty", col: c });
    } else if (st.text > 0) {
      allCols.push({ type: "unit", col: c });
    }
  }

  const qtyUnitPairs: { qtyCol: number; unitCol: number | null }[] = [];
  for (let idx = 0; idx < allCols.length; idx++) {
    if (allCols[idx].type === "qty") {
      const unitCol = allCols[idx + 1]?.type === "unit" ? allCols[idx + 1].col : null;
      qtyUnitPairs.push({ qtyCol: allCols[idx].col, unitCol });
    }
  }

  // Klasifikasi base vs package berdasarkan nilai UNIT
  let basePair = qtyUnitPairs[0] ?? null;
  let pkgPair: { qtyCol: number; unitCol: number | null } | null = null;

  if (qtyUnitPairs.length >= 2) {
    for (let r = headerRow + 1; r <= Math.min(headerRow + 15, worksheet.rowCount); r++) {
      let found = 0;
      for (const pair of qtyUnitPairs) {
        if (!pair.unitCol) { found++; continue; }
        const unitVal = String(getRawCellValue(worksheet, r, pair.unitCol) ?? "").trim().toUpperCase();
        if (!unitVal) continue;
        found++;
        if (PACKAGE_UNITS.some((u) => unitVal.includes(u))) {
          if (!pkgPair) pkgPair = pair;
        } else {
          basePair = pair;
        }
      }
      if (found >= 2 && basePair && pkgPair) break;
    }
    if (!basePair && qtyUnitPairs[0]) basePair = qtyUnitPairs[0];
    if (!pkgPair && qtyUnitPairs[1]) pkgPair = qtyUnitPairs[1];
  }

  colMap.BASE_QTY = basePair?.qtyCol;
  colMap.BASE_UNIT = basePair?.unitCol ?? undefined;
  colMap.PKG_QTY = pkgPair?.qtyCol;
  colMap.PKG_UNIT = pkgPair?.unitCol ?? undefined;

  // ── 3. Extract Items ───────────────────────────────────────────────────────
  const STOP_DESC = [
    "NOTES", "USAGE FOR", "REMARKS:", "TERMS OF PAYMENT",
    "USE BY DEPT", "USE BY DEPARTMENT", "REMARKS",
  ];

  const items: {
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    packageQty: number | null;
    packageUnit: string | null;
    packageSize: number | null;
  }[] = [];

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const descRaw = getRawCellValue(worksheet, r, descColIdx);
    if (descRaw === null || descRaw === undefined) continue;

    const descStr = String(descRaw).trim();
    if (!descStr) continue;
    const descUpper = descStr.toUpperCase();

    if (STOP_DESC.some((s) => descUpper === s || descUpper.startsWith(s))) break;

    const amountCol = colMap.AMOUNT ?? 15;
    if (rowHasSubTotal(worksheet, r, amountCol + 2)) break;

    const noVal = cleanValue(getSmartCellValue(worksheet, r, colMap.NO));
    if (noVal === null && ["TOTAL", "PPN", "VAT", "TAX", "SUBTOTAL"].some((kw) => descUpper.includes(kw))) break;

    // ── Baca package info dari kolom PACKAGE (e.g. "1 pail = 16 kg") ─────────
    let pkgInfoFromCell: ReturnType<typeof parsePackageInfo> = null;
    if (colMap.PACKAGE) {
      let pkgRaw = getCellStr(worksheet, r, colMap.PACKAGE);
      // Jika kolom PACKAGE terpisah menjadi beberapa sel (e.g. "1 pail =" | "4" | "kg" seperti di PO 0980)
      if (pkgRaw && !/\d+/.test(pkgRaw.replace(/^1\s*/, ""))) {
        const next1 = getCellStr(worksheet, r, (colMap.PACKAGE || 0) + 1);
        const next2 = getCellStr(worksheet, r, (colMap.PACKAGE || 0) + 2);
        pkgRaw = `${pkgRaw} ${next1} ${next2}`.trim();
      }
      pkgInfoFromCell = parsePackageInfo(pkgRaw);
    }

    const rawBaseQty = cleanValue(getSmartCellValue(worksheet, r, colMap.BASE_QTY), true);
    const rawPkgQty = cleanValue(getSmartCellValue(worksheet, r, colMap.PKG_QTY), true);

    // ── Tentukan qty, unit, packageQty, packageUnit ────────────────────────
    // Priority: gunakan data dari kedua kolom jika ada
    const baseQtyNum = rawBaseQty !== null ? Number(rawBaseQty) : 0;
    const pkgQtyNum = rawPkgQty !== null ? Number(rawPkgQty) : 0;

    // Untuk PO SRI-PUD: qty di PO = base unit (kg/ltr), packageQty = pail/can
    // Untuk PO PA-CS (tanpa package col): qty = base unit saja
    let qty: number;
    let unit: string;
    let packageQty: number | null = null;
    let packageUnit: string | null = null;
    let packageSize: number | null = null;

    if (pkgInfoFromCell) {
      // Ada info konversi (SRI-PUD style)
      packageUnit = pkgInfoFromCell.packageUnit;
      packageSize = pkgInfoFromCell.packageSize;

      // Jika base qty diisi dan bernilai 0 (misal di template tercetak 0 kg), berarti barang tidak diorder → skip
      if (rawBaseQty !== null && baseQtyNum <= 0) {
        continue;
      }

      if (baseQtyNum > 0 && pkgInfoFromCell.packageSize > 0) {
        qty = baseQtyNum;
        unit = (String(cleanValue(getSmartCellValue(worksheet, r, colMap.BASE_UNIT)) ?? pkgInfoFromCell.baseUnit)).trim() || pkgInfoFromCell.baseUnit;
        // Hitung packageQty secara akurat dari baseQty / packageSize (mencegah salah rumus di Excel seperti K21/15)
        packageQty = Math.round((baseQtyNum / pkgInfoFromCell.packageSize) * 100) / 100;
      } else if (pkgQtyNum > 0 && pkgInfoFromCell.packageSize > 0) {
        packageQty = pkgQtyNum;
        qty = Math.round(pkgQtyNum * pkgInfoFromCell.packageSize);
        unit = pkgInfoFromCell.baseUnit;
      } else {
        // Keduanya 0 → skip baris ini
        continue;
      }
    } else {
      // Tidak ada kolom PACKAGE (PA-CS style) → gunakan base qty/unit saja
      const combinedQty = rawBaseQty ?? rawPkgQty ?? 0;
      qty = Number(combinedQty);
      if (qty <= 0) continue;

      const rawUnit =
        cleanValue(getSmartCellValue(worksheet, r, colMap.BASE_UNIT)) ??
        cleanValue(getSmartCellValue(worksheet, r, colMap.PKG_UNIT)) ??
        "kg";
      unit = String(rawUnit).trim() || "kg";
    }

    const rawPrice = getSmartCellValue(worksheet, r, colMap["UNIT PRICE"]);
    const unitPrice =
      rawPrice !== null
        ? parseFloat(String(rawPrice).replace(/[^0-9.]/g, "")) || 0
        : 0;

    items.push({
      description: descStr,
      qty,
      unit,
      unitPrice,
      packageQty: packageQty !== null ? packageQty : null,
      packageUnit,
      packageSize,
    });
  }

  // ── 4. Scan Footer / Metadata Info (Dept, Usage For, Delivery Finish, Quotation Remarks) ──
  for (let r = 1; r <= Math.min(worksheet.rowCount, 80); r++) {
    for (let c = 1; c <= 20; c++) {
      const cellVal = getCellStr(worksheet, r, c);
      if (!cellVal) continue;
      const valUpper = cellVal.toUpperCase();

      // USE BY DEPT
      if (!department && (valUpper.includes("USE BY DEPT") || valUpper.includes("USE BY DEPARTMENT"))) {
        for (let offset = 1; offset <= 6; offset++) {
          const v = getCellStr(worksheet, r, c + offset);
          if (v && ![":", ""].includes(v)) {
            department = v.replace(/^[:\s]+/, "").trim();
            break;
          }
        }
      }

      // USAGE FOR / PURPOSE PROJECT
      if (!purposeProject && (
        valUpper.includes("USAGE FOR") ||
        valUpper.includes("PROPOSE/PROJECT") ||
        valUpper.includes("PURPOSE/PROJECT") ||
        valUpper.includes("PROPOSAL/PROJECT")
      )) {
        for (let offset = 1; offset <= 6; offset++) {
          const v = getCellStr(worksheet, r, c + offset);
          if (v && ![":", ""].includes(v)) {
            purposeProject = v.replace(/^[:\s]+/, "").trim();
            break;
          }
        }
      }

      // DELIVERY / FINISH
      if (!deliveryStr && (valUpper.includes("DELIVERY/FINISH") || valUpper.includes("DELIVERY / FINISH"))) {
        deliveryStr = cellVal;
        for (let offset = 1; offset <= 6; offset++) {
          const v = getCellStr(worksheet, r, c + offset);
          if (v && ![":", ""].includes(v)) {
            deliveryStr = `${deliveryStr} ${v}`.trim();
            break;
          }
        }
      }

      // QUOTATION / REMARKS
      if (!notes && (valUpper.includes("PRICE AS PER YOUR QUOTATION") || valUpper.includes("QUOTATION") || valUpper.includes("REMARKS:"))) {
        const m = cellVal.match(/Price As per Your Quotations?\s*[:\s]*(.*)/i);
        if (m && m[1]) notes = m[1].trim();
        else notes = cellVal.replace(/^[0-9.]+\s*/, "").replace(/^[:\s]+/, "").trim();
      }
    }
  }

  const parsedDelivery = deliveryStr ? parseDeliverySchedule(deliveryStr) : null;
  const expectedDelivery = parsedDelivery ? parsedDelivery.dateStr : null;
  const deliveryDateType = parsedDelivery ? parsedDelivery.type : "DATE";

  return {
    poNumber,
    poDate,
    supplier,
    supplierAddress,
    supplierPhone,
    supplierContactPerson,
    warehouseName,
    department,
    purposeProject,
    expectedDelivery,
    deliveryDateType,
    notes,
    items,
  };
}

// ─── API Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Upload minimal satu file Excel PO" }, { status: 400 });
    }

    const [dbSuppliers, dbItems, dbWarehouses, existingPOs] = await Promise.all([
      prisma.supplier.findMany({ where: { isActive: true } }),
      prisma.item.findMany({ where: { isActive: true } }),
      prisma.warehouse.findMany({ where: { isActive: true } }),
      prisma.purchaseOrder.findMany({ select: { poNumber: true } }),
    ]);

    const existingPoSet = new Set(existingPOs.map((p) => p.poNumber.toUpperCase()));
    const usedItemCodes = new Set(dbItems.map((i) => i.code.toUpperCase()));
    const usedSupCodes = new Set(dbSuppliers.map((s) => s.code.toUpperCase()));
    const usedWhCodes = new Set(dbWarehouses.map((w) => w.code.toUpperCase()));

    function getNextAutoCode(usedSet: Set<string>, prefix: string): string {
      let counter = 1;
      while (true) {
        const code = `${prefix}-${String(counter).padStart(3, "0")}`;
        if (!usedSet.has(code.toUpperCase())) {
          usedSet.add(code.toUpperCase());
          return code;
        }
        counter++;
      }
    }

    const resultPOs: any[] = [];
    let totalNewSuppliers = 0;
    let totalNewItems = 0;
    let totalDuplicates = 0;

    const batchSupCache = new Map<string, string>();
    const batchItemCache = new Map<string, string>();
    const batchWhCache = new Map<string, string>(); // whNameLower -> whId

    // Populate existing warehouses into cache
    for (const w of dbWarehouses) {
      batchWhCache.set(w.name.toLowerCase(), w.id);
    }

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer as any);

      for (const worksheet of workbook.worksheets) {
        // Pass filename as fallback for PO number extraction
        const extracted = extractPoDataFromSheet(worksheet, file.name);
        if (!extracted.poNumber || extracted.items.length === 0) continue;

        const isDuplicateInDb = existingPoSet.has(extracted.poNumber.toUpperCase());
        if (isDuplicateInDb) totalDuplicates++;

        // Supplier
        const supName = (extracted.supplier || "Supplier Excel").trim();
        const supKey = supName.toLowerCase();
        const matchedSup = dbSuppliers.find(
          (s) =>
            s.name.toLowerCase().includes(supKey) ||
            supKey.includes(s.name.toLowerCase())
        );
        const supplierStatus = matchedSup ? "EXISTING" : "NEW_AUTO_CREATE";
        if (!matchedSup && !batchSupCache.has(supKey)) {
          const autoSupCode = getNextAutoCode(usedSupCodes, "SUP-AUTO");
          batchSupCache.set(supKey, autoSupCode);
          totalNewSuppliers++;
        }

        // Warehouse matching
        const whName = extracted.warehouseName;
        const whKey = whName.toLowerCase();
        const matchedWh = dbWarehouses.find((w) => w.name.toLowerCase() === whKey || w.name.toLowerCase().includes(whKey));
        let suggestedWhCode = matchedWh ? matchedWh.code : "";
        if (!matchedWh) {
          if (whKey.includes("plant 1") && !usedWhCodes.has("WH-PLANT1")) suggestedWhCode = "WH-PLANT1";
          else if (whKey.includes("plant 2") && !usedWhCodes.has("WH-PLANT2")) suggestedWhCode = "WH-PLANT2";
          else if (whKey.includes("preparation") && !usedWhCodes.has("WH-PREP")) suggestedWhCode = "WH-PREP";
          else suggestedWhCode = getNextAutoCode(usedWhCodes, "WH-AUTO");
          usedWhCodes.add(suggestedWhCode.toUpperCase());
        }

        // Items — gunakan normalizeName untuk matching
        const processedItems = extracted.items.map((item) => {
          const itemKey = normalizeName(item.description);
          let matchedItem = dbItems.find(
            (i) =>
              itemKey === normalizeName(i.name) ||
              itemKey.includes(normalizeName(i.name)) ||
              itemKey.includes(i.code.toLowerCase()) ||
              normalizeName(i.name).includes(itemKey)
          );
          // Fuzzy fallback: contains-based untuk typo minor
          if (!matchedItem) {
            matchedItem = dbItems.find(
              (i) => {
                const ni = normalizeName(i.name);
                return itemKey.includes(ni) || ni.includes(itemKey) ||
                  (itemKey.length > 10 && ni.length > 10 &&
                   (itemKey.substring(0,10) === ni.substring(0,10) ||
                    itemKey.substring(itemKey.length-10) === ni.substring(ni.length-10)));
              }
            );
          }
          const itemStatus = matchedItem ? "EXISTING" : "NEW_AUTO_CREATE";
          if (!matchedItem && !batchItemCache.has(itemKey)) {
            const autoItemCode = getNextAutoCode(usedItemCodes, "ITM-AUTO");
            batchItemCache.set(itemKey, autoItemCode);
            totalNewItems++;
          }
          // Fallback ke Master Item jika info kemasan belum terisi dari Excel
          const finalPackageUnit = item.packageUnit || matchedItem?.packageUnit || null;
          const finalPackageSize = item.packageSize || (matchedItem?.packageSize ? Number(matchedItem.packageSize) : null);
          const finalPackageQty = item.packageQty != null
            ? item.packageQty
            : finalPackageSize && finalPackageSize > 0
              ? Math.round((item.qty / finalPackageSize) * 100) / 100
              : null;

          return {
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            unitPrice: item.unitPrice,
            packageQty: finalPackageQty,
            packageUnit: finalPackageUnit,
            packageSize: finalPackageSize,
            itemStatus,
            matchedItemId: matchedItem ? matchedItem.id : "",
            suggestedItemCode: matchedItem ? matchedItem.code : (batchItemCache.get(itemKey) ?? ""),
            suggestedItemName: item.description,
          };
        });

        resultPOs.push({
          poNumber: extracted.poNumber,
          poDate: extracted.poDate || null,
          supplierName: supName,
          supplierStatus,
          matchedSupplierId: matchedSup ? matchedSup.id : "",
          suggestedSupplierCode: matchedSup ? matchedSup.code : (batchSupCache.get(supKey) ?? ""),
          suggestedSupplierName: supName,
          supplierAddress: extracted.supplierAddress || matchedSup?.address || null,
          supplierPhone: extracted.supplierPhone || matchedSup?.phone || null,
          supplierContactPerson: extracted.supplierContactPerson || matchedSup?.contactPerson || null,
          warehouseName: whName,
          matchedWarehouseId: matchedWh ? matchedWh.id : "",
          suggestedWarehouseCode: suggestedWhCode,
          department: extracted.department || null,
          purposeProject: extracted.purposeProject || null,
          expectedDelivery: extracted.expectedDelivery || null,
          deliveryDateType: extracted.deliveryDateType || "DATE",
          notes: extracted.notes || null,
          isDuplicateInDb,
          sourceFile: file.name,
          items: processedItems,
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalPOs: resultPOs.length,
        totalItems: resultPOs.reduce((s, p) => s + p.items.length, 0),
        totalNewSuppliers,
        totalNewItems,
        totalDuplicates,
      },
      pos: resultPOs,
    });
  } catch (error: any) {
    console.error("PO parse error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengolah file PO Excel" }, { status: 500 });
  }
}
