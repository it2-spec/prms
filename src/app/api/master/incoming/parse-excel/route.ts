import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

function unwrap(v: any): any {
  if (v && typeof v === "object" && "result" in v) return v.result;
  return v;
}

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function toDateStr(v: any): string {
  if (v === null || v === undefined) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  const parsed = new Date(v);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: "File Excel tidak memiliki sheet" }, { status: 400 });
    }

    // ── Header-driven column mapping ──────────────────────────────────────
    // Cari header row di 1-3 baris pertama
    let headerRowIdx = 1;
    const colMap: Record<string, number | null> = {};

    for (let tryRow = 1; tryRow <= 3; tryRow++) {
      const candidate: Record<string, number> = {};
      for (let c = 1; c <= worksheet.columnCount; c++) {
        const h = String(unwrap(worksheet.getRow(tryRow).getCell(c).value) ?? "").trim().toUpperCase();
        if (!h) continue;

        if ((h.includes("PO NO") || h.includes("PO NUMBER") || h.includes("NO PO")) && !candidate.poNumber)
          candidate.poNumber = c;
        else if ((h.includes("DESCRIPTION") || h.includes("NAMA BARANG") || h === "ITEM" || h === "ITEMS") && !candidate.itemName)
          candidate.itemName = c;
        else if ((h === "QTY" || h === "QUANTITY" || h === "QTY ORDER") && !candidate.qty)
          candidate.qty = c;
        else if ((h === "UNIT" || h === "SATUAN") && !candidate.unit)
          candidate.unit = c;
        else if ((h.includes("SUPPLIER") || h === "PEMASOK") && !candidate.supplierName)
          candidate.supplierName = c;
        else if ((h.includes("DATE_PO") || h.includes("PO DATE") || h.includes("TANGGAL PO") || h === "DATE") && !candidate.poDate)
          candidate.poDate = c;
        else if ((h.includes("RECEIVED QTY") || h.includes("RECEIVE QTY") || h.includes("QTY RECEIVED") || h === "RECEIVED") && !candidate.receivedQty)
          candidate.receivedQty = c;
        else if ((h.includes("SURAT JALAN") || h === "SJ" || h.includes("NO SJ")) && !candidate.suratJalan)
          candidate.suratJalan = c;
        else if ((h.includes("RECEIVE DATE") || h.includes("RECEIVED DATE") || h.includes("TANGGAL TERIMA")) && !candidate.receiveDate)
          candidate.receiveDate = c;
        else if ((h.includes("PACKAGE") && !h.includes("SIZE")) || h.includes("KEMASAN") && !candidate.packageUnit)
          candidate.packageUnit = c;
        else if (h.includes("PACKAGE SIZE") || h.includes("PKG SIZE") && !candidate.packageSize)
          candidate.packageSize = c;
        else if ((h.includes("UNIT PRICE") || h.includes("HARGA SATUAN") || (h.includes("PRICE") && !h.includes("TOTAL"))) && !candidate.unitPrice)
          candidate.unitPrice = c;
      }

      if (candidate.poNumber && candidate.itemName) {
        headerRowIdx = tryRow;
        Object.assign(colMap, candidate);
        break;
      }
    }

    if (!colMap.poNumber || !colMap.itemName) {
      return NextResponse.json({ error: "Header kolom PO NO / DESCRIPTIONS tidak ditemukan" }, { status: 400 });
    }

    const rows: {
      poNumber: string;
      itemName: string;
      packageUnit: string;
      packageSize: number;
      qty: number;
      unit: string;
      unitPrice: number;
      supplierName: string;
      poDate: string;
      receivedQty: number;
      suratJalan: string;
      receiveDate: string;
    }[] = [];

    const poSet = new Set<string>();
    const sjSet = new Set<string>();
    const itemSet = new Set<string>();

    for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
      const get = (col: number | null) => (col ? unwrap(worksheet.getRow(r).getCell(col).value) : null);

      const poNumber = String(get(colMap.poNumber) ?? "").trim();
      const itemName = String(get(colMap.itemName) ?? "").trim();
      if (!poNumber || !itemName) continue;

      const qty = toNumber(get(colMap.qty));
      const receivedQtyRaw = toNumber(get(colMap.receivedQty));
      const receivedQty = receivedQtyRaw || qty;

      const row = {
        poNumber,
        itemName,
        packageUnit: String(get(colMap.packageUnit) ?? "PAIL").trim() || "PAIL",
        packageSize: toNumber(get(colMap.packageSize)) || 20,
        qty,
        unit: String(get(colMap.unit) ?? "kg").trim() || "kg",
        unitPrice: toNumber(get(colMap.unitPrice)),
        supplierName: String(get(colMap.supplierName) ?? "PT. SHINANOA INDONESIA").trim(),
        poDate: toDateStr(get(colMap.poDate)),
        receivedQty,
        suratJalan: String(get(colMap.suratJalan) ?? "").trim(),
        receiveDate: toDateStr(get(colMap.receiveDate)),
      };

      poSet.add(poNumber);
      if (row.suratJalan) sjSet.add(row.suratJalan);
      itemSet.add(itemName);
      rows.push(row);
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      totalPOs: poSet.size,
      totalSJs: sjSet.size,
      totalItems: itemSet.size,
      rows,
    });
  } catch (err: any) {
    console.error("parse-incoming-excel error:", err);
    return NextResponse.json({ error: err.message || "Gagal membaca file Excel" }, { status: 500 });
  }
}
