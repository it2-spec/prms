import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { cleanItemName, matchPaintItem } from "@/lib/string-similarity";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || (user.role !== "PURCHASING" && user.role !== "WAREHOUSE")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    // ── Handle Action: COMMIT (JSON Payload) ─────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const mappings: { paintingCode: string; targetItemId: string }[] = body.mappings || [];

      if (!Array.isArray(mappings) || mappings.length === 0) {
        return NextResponse.json({ error: "Tidak ada data pemetaan yang dipilih untuk disimpan." }, { status: 400 });
      }

      // Validasi item exists
      const targetItemIds = mappings.map((m) => m.targetItemId).filter(Boolean);
      const validItems = await prisma.item.findMany({
        where: { id: { in: targetItemIds } },
        select: { id: true, code: true, name: true },
      });
      const validIdSet = new Set(validItems.map((i) => i.id));

      const updateOps = [];
      for (const m of mappings) {
        const pCode = (m.paintingCode || "").trim();
        if (!pCode || !validIdSet.has(m.targetItemId)) continue;

        updateOps.push(
          prisma.item.update({
            where: { id: m.targetItemId },
            data: { paintingCode: pCode },
          })
        );
      }

      if (updateOps.length === 0) {
        return NextResponse.json({ error: "Tidak ada pemetaan valid yang dapat disimpan." }, { status: 400 });
      }

      // Batch transaction tanpa batas interactive timeout 5000ms
      await prisma.$transaction(updateOps, { timeout: 60000, maxWait: 10000 });
      const updatedCount = updateOps.length;

      await writeAuditLog(
        user,
        "RECONCILE_PAINTING_CODES",
        "Item",
        undefined,
        `Berhasil merekonsiliasi dan menghubungkan ${updatedCount} kode item painting ke Master Item`
      );

      return NextResponse.json({
        success: true,
        updatedCount,
        message: `Berhasil memperbarui ${updatedCount} kode item painting di Master Item!`,
      });
    }

    // ── Handle Action: PREVIEW (Upload File Excel) ───────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File Excel wajib diunggah." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: "File Excel kosong atau sheet tidak valid." }, { status: 400 });
    }

    // Deteksi Header Dinamis (periksa baris per baris secara independen)
    let headerRowIdx = -1;
    let colMap: { paintingCode?: number; name?: number; unit?: number } = {};

    for (let r = 1; r <= 15; r++) {
      const row = worksheet.getRow(r);
      const tempColMap: { paintingCode?: number; name?: number; unit?: number } = {};

      for (let c = 1; c <= 20; c++) {
        const val = String(row.getCell(c).value || "").trim().toUpperCase();
        if (!val) continue;

        // Cek kolom kode painting
        if (
          val === "KODE PAINTING" ||
          val.startsWith("KODE PAINTING") ||
          val.includes("KODE GUDANG") ||
          val.includes("KODE PART") ||
          val.includes("KODE ITEM") ||
          val === "PART NO" ||
          val === "PART NO." ||
          val === "ITEM CODE" ||
          val === "CODE" ||
          val === "KODE"
        ) {
          if (!tempColMap.paintingCode) tempColMap.paintingCode = c;
        }

        // Cek kolom nama barang (harus di kolom berbeda dengan kode)
        if (
          val === "NAMA BARANG" ||
          val.startsWith("NAMA BARANG") ||
          val.includes("NAMA PART") ||
          val.includes("NAMA ITEM") ||
          val.includes("PART NAME") ||
          val.includes("ITEM NAME") ||
          val.includes("DESCRIPTIONS") ||
          val.includes("DESCRIPTION") ||
          val.includes("DESKRIPSI")
        ) {
          if (!tempColMap.name && c !== tempColMap.paintingCode) tempColMap.name = c;
        }

        if (
          val.includes("SATUAN") ||
          val.includes("UNIT") ||
          val.includes("KEMASAN") ||
          val.includes("PACKAGING")
        ) {
          if (!tempColMap.unit) tempColMap.unit = c;
        }
      }

      // Baris header yang valid wajib memiliki kolom kode dan kolom nama yang berbeda
      if (tempColMap.paintingCode && tempColMap.name && tempColMap.paintingCode !== tempColMap.name) {
        headerRowIdx = r;
        colMap = tempColMap;
        break;
      }
    }

    // Fallback jika tidak terdeteksi header khusus
    if (!colMap.paintingCode) colMap.paintingCode = 1;
    if (!colMap.name) colMap.name = 2;
    if (headerRowIdx === -1) headerRowIdx = 1;

    // Load semua Master Item aktif dari database
    const dbItems = await prisma.item.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        paintingCode: true,
        unit: true,
        packageUnit: true,
        packageSize: true,
        isActive: true,
      },
      orderBy: { code: "asc" },
    });

    type MasterItemBrief = typeof dbItems[0];

    // Buat index pencarian
    const existingPaintingCodeMap = new Map<string, MasterItemBrief>();
    const exactNameMap = new Map<string, MasterItemBrief>();
    const purchasingCodeMap = new Map<string, MasterItemBrief>();

    for (const item of dbItems) {
      if (item.paintingCode) {
        existingPaintingCodeMap.set(item.paintingCode.toUpperCase().trim(), item);
      }
      purchasingCodeMap.set(item.code.toUpperCase().trim(), item);
      exactNameMap.set(cleanItemName(item.name), item);
    }

    type ReconcileRow = {
      rowIndex: number;
      paintingCode: string;
      paintingName: string;
      paintingUnit?: string;
      matchedItem: {
        id: string;
        code: string;
        name: string;
        currentPaintingCode?: string | null;
        unit?: string | null;
        packageUnit?: string | null;
      } | null;
      matchType: "EXACT_CODE" | "EXACT_NAME" | "FUZZY_HIGH" | "FUZZY_MEDIUM" | "NONE";
      matchScore: number; // 0 - 100
      status: "MATCHED" | "REVIEW" | "UNMATCHED";
    };

    const results: ReconcileRow[] = [];
    const usedTargetItemIds = new Set<string>();

    for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const rawCode = String(row.getCell(colMap.paintingCode!).value || "").trim().toUpperCase();
      const rawName = String(row.getCell(colMap.name!).value || "").trim();
      const rawUnit = colMap.unit ? String(row.getCell(colMap.unit).value || "").trim() : undefined;

      // Lewati baris kosong
      if (!rawCode && !rawName) continue;

      let matched: MasterItemBrief | null = null;
      let matchType: ReconcileRow["matchType"] = "NONE";
      let matchScore = 0;

      // 1. Prioritas 1: Sudah pernah terhubung ke kode painting ini
      if (rawCode && existingPaintingCodeMap.has(rawCode)) {
        matched = existingPaintingCodeMap.get(rawCode)!;
        matchType = "EXACT_CODE";
        matchScore = 100;
      }
      // 2. Prioritas 2: Kode painting sama dengan kode purchasing
      else if (rawCode && purchasingCodeMap.has(rawCode)) {
        matched = purchasingCodeMap.get(rawCode)!;
        matchType = "EXACT_CODE";
        matchScore = 100;
      }
      // 3. Prioritas 3: Nama Persis setelah dibersihkan
      else if (rawName) {
        const cleanName = cleanItemName(rawName);
        if (exactNameMap.has(cleanName)) {
          matched = exactNameMap.get(cleanName)!;
          matchType = "EXACT_NAME";
          matchScore = 98;
        } else {
          // 4. Prioritas 4: Smart Strict Paint Matching
          let bestCandidate: MasterItemBrief | null = null;
          let highestScore = 0;

          for (const item of dbItems) {
            const res = matchPaintItem(rawName, item.name);
            if (res.score > highestScore) {
              highestScore = res.score;
              bestCandidate = item;
            }
          }

          if (bestCandidate && highestScore >= 70) {
            matched = bestCandidate;
            matchType = highestScore >= 85 ? "FUZZY_HIGH" : "FUZZY_MEDIUM";
            matchScore = highestScore;
          } else {
            matched = null;
            matchType = "NONE";
            matchScore = 0;
          }
        }
      }

      let status: ReconcileRow["status"] = "UNMATCHED";
      if (matchType === "EXACT_CODE" || matchType === "EXACT_NAME" || matchType === "FUZZY_HIGH") {
        status = "MATCHED";
      } else if (matchType === "FUZZY_MEDIUM") {
        status = "REVIEW";
      }

      if (matched) {
        usedTargetItemIds.add(matched.id);
      }

      results.push({
        rowIndex: r,
        paintingCode: rawCode,
        paintingName: rawName,
        paintingUnit: rawUnit,
        matchedItem: matched
          ? {
              id: matched.id,
              code: matched.code,
              name: matched.name,
              currentPaintingCode: matched.paintingCode,
              unit: matched.unit,
              packageUnit: matched.packageUnit,
            }
          : null,
        matchType,
        matchScore,
        status,
      });
    }

    const summary = {
      totalRows: results.length,
      matchedCount: results.filter((r) => r.status === "MATCHED").length,
      reviewCount: results.filter((r) => r.status === "REVIEW").length,
      unmatchedCount: results.filter((r) => r.status === "UNMATCHED").length,
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
      allMasterItems: dbItems.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        paintingCode: i.paintingCode,
        packageUnit: i.packageUnit,
        unit: i.unit,
      })),
    });
  } catch (error: any) {
    console.error("Error in reconcile-painting API:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan pada pemrosesan rekonsiliasi painting" },
      { status: 500 }
    );
  }
}
