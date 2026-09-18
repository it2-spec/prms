import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

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

    // Detect header row — look for "DESCRIPTIONS" or "DESCRIPTION" in col 1
    let headerRow = -1;
    worksheet.eachRow((row, rn) => {
      if (headerRow !== -1) return;
      const cell1 = String(row.getCell(1).value ?? "").trim().toUpperCase();
      if (cell1 === "DESCRIPTIONS" || cell1 === "DESCRIPTION" || cell1 === "NAMA BARANG") {
        headerRow = rn;
      }
    });

    if (headerRow === -1) {
      return NextResponse.json({
        error: "Header tidak ditemukan. Pastikan kolom pertama bernama 'DESCRIPTIONS'",
      }, { status: 400 });
    }

    // Map columns from header — try name-based first, fall back to positional
    const hRow = worksheet.getRow(headerRow);
    const colMap: Record<string, number> = {};
    hRow.eachCell({ includeEmpty: false }, (cell, cn) => {
      const v = String(cell.value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
      if ((v.includes("DESCRIPTION") || v.includes("NAMA BARANG")) && !colMap.NAME) colMap.NAME = cn;
      else if ((v.includes("PACKAGE UNIT") || v === "KEMASAN") && !colMap.PKG_UNIT) colMap.PKG_UNIT = cn;
      else if ((v.includes("PACKAGE SIZE") || v === "ISIAN") && !colMap.PKG_SIZE) colMap.PKG_SIZE = cn;
      else if ((v === "UNIT" || v === "SATUAN") && !colMap.UNIT) colMap.UNIT = cn;
      else if (
        !colMap.PRICE_KG &&
        (
          (v.includes("HARGA") && !v.includes("/CAN") && !v.includes("KEMASAN") && !v.includes("CAN")) ||
          (v.includes("PRICE") && !v.includes("CAN") && !v.includes("TOTAL"))
        )
      ) {
        colMap.PRICE_KG = cn;
      }
    });

    // Fallback: if header detection fails, use fixed positional mapping
    // Standard format: col1=name, col2=pkgUnit, col3=pkgSize, col4=unit, col5=priceKg
    if (!colMap.NAME) colMap.NAME = 1;
    if (!colMap.PKG_UNIT) colMap.PKG_UNIT = 2;
    if (!colMap.PKG_SIZE) colMap.PKG_SIZE = 3;
    if (!colMap.UNIT) colMap.UNIT = 4;
    if (!colMap.PRICE_KG) colMap.PRICE_KG = 5;

    if (!colMap.NAME) {
      return NextResponse.json({
        error: "Kolom DESCRIPTIONS tidak ditemukan di header",
      }, { status: 400 });
    }

    const items: {
      name: string;
      packageUnit: string | null;
      packageSize: number | null;
      unit: string | null;
      lastUnitPrice: number | null;
    }[] = [];

    worksheet.eachRow((row, rn) => {
      if (rn <= headerRow) return;

      const rawName = row.getCell(colMap.NAME ?? 1).value;
      if (!rawName) return;
      const name = String(rawName).trim();
      if (!name) return;

      // Skip total/subtotal/etc
      const nameUpper = name.toUpperCase();
      if (["TOTAL", "SUB TOTAL", "SUBTOTAL", "NOTES", "REMARK"].some(k => nameUpper.startsWith(k))) return;

      const rawPkgUnit = colMap.PKG_UNIT ? row.getCell(colMap.PKG_UNIT).value : null;
      const rawPkgSize = colMap.PKG_SIZE ? row.getCell(colMap.PKG_SIZE).value : null;
      const rawUnit = colMap.UNIT ? row.getCell(colMap.UNIT).value : null;
      const rawPrice = colMap.PRICE_KG ? row.getCell(colMap.PRICE_KG).value : null;

      // Unwrap formula result
      function unwrap(v: any): any {
        if (v && typeof v === "object" && "result" in v) return v.result;
        return v;
      }

      const packageUnit = rawPkgUnit ? String(unwrap(rawPkgUnit)).trim().toLowerCase() || null : null;
      const pkgSizeRaw = unwrap(rawPkgSize);
      const packageSize = pkgSizeRaw != null && !isNaN(Number(pkgSizeRaw)) ? Number(pkgSizeRaw) : null;
      const unit = rawUnit ? String(unwrap(rawUnit)).trim() || null : null;
      const priceRaw = unwrap(rawPrice);
      const lastUnitPrice = priceRaw != null && !isNaN(Number(String(priceRaw).replace(/,/g, "")))
        ? Number(String(priceRaw).replace(/,/g, ""))
        : null;

      items.push({ name, packageUnit, packageSize, unit, lastUnitPrice });
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "Tidak ada item ditemukan di file" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      totalItems: items.length,
      items,
      previewColumns: {
        name: colMap.NAME,
        packageUnit: colMap.PKG_UNIT,
        packageSize: colMap.PKG_SIZE,
        unit: colMap.UNIT,
        priceKg: colMap.PRICE_KG,
      },
    });
  } catch (err: any) {
    console.error("parse-items-excel error:", err);
    return NextResponse.json({ error: err.message || "Gagal membaca file Excel" }, { status: 500 });
  }
}
