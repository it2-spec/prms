import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const action = (formData.get("action") as string) || "preview"; // "preview" or "commit"

    if (!file) {
      return NextResponse.json({ error: "File Excel wajib diunggah" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: "File Excel kosong" }, { status: 400 });
    }

    // Cari header row
    let headerRowIdx = -1;
    let colMap: {
      id?: number;
      currentCode?: number;
      paintingCode?: number;
      newCode?: number;
      name?: number;
      unit?: number;
      packageUnit?: number;
      packageSize?: number;
    } = {};

    for (let r = 1; r <= 15; r++) {
      const row = worksheet.getRow(r);
      for (let c = 1; c <= 15; c++) {
        const val = String(row.getCell(c).value || "").trim().toUpperCase();
        if (val.includes("ID ITEM") || val === "ID") colMap.id = c;
        if (val.includes("KODE SEKARANG") || val.includes("KODE LAMA")) colMap.currentCode = c;
        if (val.includes("KODE PAINTING") || val.includes("PAINTING") || val.includes("KODE GUDANG")) colMap.paintingCode = c;
        if (val.includes("KODE BARU") || val.includes("KODE STANDAR") || val === "NEW CODE") colMap.newCode = c;
        if (val.includes("NAMA BARANG") || val.includes("DESCRIPTION")) colMap.name = c;
        if (val.includes("SATUAN DASAR") || val === "SATUAN" || val === "UNIT") colMap.unit = c;
        if (val === "KEMASAN" || val.includes("PACKAGE UNIT") || val.includes("SATUAN KEMASAN")) colMap.packageUnit = c;
        if (val.includes("ISI KEMASAN") || val.includes("PACKAGE SIZE") || val === "ISI") colMap.packageSize = c;
      }
      if (colMap.newCode || (colMap.id && colMap.name)) {
        headerRowIdx = r;
        break;
      }
    }

    // Default fallback columns jika header tidak terdeteksi spesifik:
    if (!colMap.id) colMap.id = 1;
    if (!colMap.currentCode) colMap.currentCode = 2;
    if (!colMap.paintingCode) colMap.paintingCode = 3;
    if (!colMap.newCode) colMap.newCode = 4;
    if (!colMap.name) colMap.name = 5;
    if (headerRowIdx === -1) headerRowIdx = 1;

    // Load semua item yang ada di DB untuk verifikasi
    const dbItems = await prisma.item.findMany();
    const idMap = new Map(dbItems.map((i) => [i.id, i]));
    const nameMap = new Map(dbItems.map((i) => [i.name.toLowerCase().trim(), i]));
    const codeMap = new Map(dbItems.map((i) => [i.code.toUpperCase().trim(), i]));

    const parsedUpdates: {
      itemId: string;
      itemName: string;
      oldCode: string;
      newCode: string;
      paintingCode?: string;
      unit?: string;
      packageUnit?: string;
      packageSize?: number;
      status: "VALID" | "DUPLICATE" | "UNCHANGED" | "NOT_FOUND";
      message?: string;
    }[] = [];

    const usedNewCodes = new Set<string>();

    for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const rawId = String(row.getCell(colMap.id!).value || "").trim();
      const rawCurrentCode = String(row.getCell(colMap.currentCode!).value || "").trim();
      const rawNewCode = String(row.getCell(colMap.newCode!).value || "").trim().toUpperCase();
      const rawName = String(row.getCell(colMap.name!).value || "").trim();

      if (!rawId && !rawCurrentCode && !rawName) continue;

      // Cari item di database
      let matchedItem = (rawId && idMap.get(rawId)) || null;
      if (!matchedItem && rawCurrentCode) {
        matchedItem = codeMap.get(rawCurrentCode.toUpperCase()) || null;
      }
      if (!matchedItem && rawName) {
        matchedItem = nameMap.get(rawName.toLowerCase()) || null;
      }

      if (!matchedItem) {
        parsedUpdates.push({
          itemId: rawId || `row-${r}`,
          itemName: rawName || "Item tidak dikenal",
          oldCode: rawCurrentCode || "-",
          newCode: rawNewCode,
          status: "NOT_FOUND",
          message: "Item tidak ditemukan di database PRMS",
        });
        continue;
      }

      const rawPaintingCode = colMap.paintingCode ? String(row.getCell(colMap.paintingCode).value || "").trim() : undefined;
      const rawUnit = colMap.unit ? String(row.getCell(colMap.unit).value || "").trim() : undefined;
      const rawPkgUnitStr = colMap.packageUnit ? String(row.getCell(colMap.packageUnit).value || "").trim() : undefined;
      const rawPkgSizeVal = colMap.packageSize ? row.getCell(colMap.packageSize).value : undefined;

      const rawPkgUnit = rawPkgUnitStr && rawPkgUnitStr !== "-" ? rawPkgUnitStr : undefined;
      let rawPkgSize: number | undefined = undefined;
      if (rawPkgSizeVal !== null && rawPkgSizeVal !== undefined && String(rawPkgSizeVal).trim() !== "") {
        const parsedSize = parseFloat(String(rawPkgSizeVal).replace(/[^0-9.]/g, ""));
        if (!isNaN(parsedSize) && parsedSize > 0) {
          rawPkgSize = parsedSize;
        }
      }

      const isCodeChanged = Boolean(rawNewCode && rawNewCode !== matchedItem.code.toUpperCase().trim());
      const isPaintingCodeChanged = rawPaintingCode !== undefined && rawPaintingCode !== (matchedItem.paintingCode || "");
      const isUnitChanged = Boolean(rawUnit && rawUnit !== (matchedItem.unit || ""));
      const isPkgUnitChanged = Boolean(rawPkgUnit !== undefined && rawPkgUnit !== (matchedItem.packageUnit || ""));
      const isPkgSizeChanged = Boolean(rawPkgSize !== undefined && rawPkgSize !== Number(matchedItem.packageSize || 0));

      const hasAnyChanges = isCodeChanged || isPaintingCodeChanged || isUnitChanged || isPkgUnitChanged || isPkgSizeChanged;

      if (!hasAnyChanges) {
        parsedUpdates.push({
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          oldCode: matchedItem.code,
          newCode: rawNewCode || matchedItem.code,
          status: "UNCHANGED",
          message: "Tidak ada perubahan",
        });
        continue;
      }

      // Jika kode diubah, cek duplikat di DB
      if (isCodeChanged) {
        const existingWithNewCode = codeMap.get(rawNewCode);
        if (existingWithNewCode && existingWithNewCode.id !== matchedItem.id) {
          parsedUpdates.push({
            itemId: matchedItem.id,
            itemName: matchedItem.name,
            oldCode: matchedItem.code,
            newCode: rawNewCode,
            status: "DUPLICATE",
            message: `Kode "${rawNewCode}" sudah digunakan oleh item: ${existingWithNewCode.name}`,
          });
          continue;
        }

        // Cek duplikat dalam file
        if (usedNewCodes.has(rawNewCode)) {
          parsedUpdates.push({
            itemId: matchedItem.id,
            itemName: matchedItem.name,
            oldCode: matchedItem.code,
            newCode: rawNewCode,
            status: "DUPLICATE",
            message: `Kode "${rawNewCode}" muncul lebih dari satu kali di file Excel`,
          });
          continue;
        }
        usedNewCodes.add(rawNewCode);
      }

      parsedUpdates.push({
        itemId: matchedItem.id,
        itemName: matchedItem.name,
        oldCode: matchedItem.code,
        newCode: rawNewCode || matchedItem.code,
        paintingCode: rawPaintingCode,
        unit: isUnitChanged ? rawUnit : undefined,
        packageUnit: isPkgUnitChanged ? rawPkgUnit : undefined,
        packageSize: isPkgSizeChanged ? rawPkgSize : undefined,
        status: "VALID",
        message: isCodeChanged ? "Siap update kode & spesifikasi" : "Siap update spesifikasi kemasan",
      });
    }

    const validUpdates = parsedUpdates.filter((p) => p.status === "VALID");
    const duplicateCount = parsedUpdates.filter((p) => p.status === "DUPLICATE").length;
    const unchangedCount = parsedUpdates.filter((p) => p.status === "UNCHANGED").length;

    // Jika mode preview, kembalikan data pratinjau
    if (action === "preview") {
      return NextResponse.json({
        success: true,
        summary: {
          totalRows: parsedUpdates.length,
          validCount: validUpdates.length,
          duplicateCount,
          unchangedCount,
        },
        items: parsedUpdates,
      });
    }

    // Jika mode commit, eksekusi pembaruan ke database
    if (validUpdates.length === 0) {
      return NextResponse.json({
        error: "Tidak ada data pembaruan yang valid untuk disimpan.",
      }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const update of validUpdates) {
        const updateData: any = {};
        if (update.newCode && update.newCode !== update.oldCode) {
          updateData.code = update.newCode;
        }
        if (update.paintingCode !== undefined) {
          updateData.paintingCode = update.paintingCode || null;
        }
        if (update.unit !== undefined) {
          updateData.unit = update.unit;
        }
        if (update.packageUnit !== undefined) {
          updateData.packageUnit = update.packageUnit || null;
        }
        if (update.packageSize !== undefined) {
          updateData.packageSize = update.packageSize;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.item.update({
            where: { id: update.itemId },
            data: updateData,
          });
        }
      }
    });

    await writeAuditLog(
      user,
      "BATCH_UPDATE_ITEM_CODES",
      "Item",
      undefined,
      `Memperbarui ${validUpdates.length} kode master item via Excel massal`
    );

    return NextResponse.json({
      success: true,
      updatedCount: validUpdates.length,
      message: `Berhasil memperbarui ${validUpdates.length} kode item! Nama barang tetap dipertahankan dari data PO.`,
    });
  } catch (error: any) {
    console.error("Update item codes error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses file Excel" }, { status: 500 });
  }
}
