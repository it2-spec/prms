import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || (user.role !== "PURCHASING" && user.role !== "WAREHOUSE")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil data master items aktif untuk lembar referensi
    const masterItems = await prisma.item.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        code: true,
        paintingCode: true,
        name: true,
        packageUnit: true,
        packageSize: true,
        unit: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PRMS Purchasing & Warehouse System";
    workbook.created = new Date();

    // ── SHEET 1: Input Data Painting ──────────────────────────────────────────
    const wsInput = workbook.addWorksheet("Data Item Painting", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 3 }],
    });

    // Judul & Petunjuk di atas tabel
    wsInput.mergeCells("A1:D1");
    const titleCell = wsInput.getCell("A1");
    titleCell.value = "TEMPLATE DAFTAR ITEM DEPARTEMEN PAINTING (UNTUK REKONSILIASI KODE)";
    titleCell.font = { bold: true, size: 12, color: { argb: "FF0F766E" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };
    wsInput.getRow(1).height = 24;

    wsInput.mergeCells("A2:D2");
    const subCell = wsInput.getCell("A2");
    subCell.value = "Isi kolom Kode Painting dan Nama Barang Painting di bawah ini. Kode Painting akan dihubungkan ke Master Item PRMS via Fuzzy Matching.";
    subCell.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    subCell.alignment = { vertical: "middle", horizontal: "left" };
    wsInput.getRow(2).height = 18;

    // Header Table (Row 3)
    const headerRow = wsInput.getRow(3);
    headerRow.height = 30;

    wsInput.columns = [
      { key: "paintingCode", width: 25 },
      { key: "paintingName", width: 45 },
      { key: "packaging", width: 18 },
      { key: "notes", width: 30 },
    ];

    headerRow.getCell(1).value = "Kode Painting (Gudang) *";
    headerRow.getCell(2).value = "Nama Barang Painting *";
    headerRow.getCell(3).value = "Kemasan (Opsional)";
    headerRow.getCell(4).value = "Keterangan / Lokasi (Opsional)";

    // Style Header Row
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      if (colNumber <= 2) {
        // Kolom wajib (Teal tua)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F766E" }, // Teal 700
        };
      } else {
        // Kolom opsional (Slate)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF475569" }, // Slate 600
        };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "medium", color: { argb: "FF0D9488" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    // Contoh data sampel untuk mempermudah pemahaman pengguna
    const sampleRows = [
      {
        paintingCode: "PTG-CSH18-04",
        paintingName: "Pikanet Eco CSH18008 Silver SR No. 4",
        packaging: "Pail 18 kg",
        notes: "Stock Plant 2",
      },
      {
        paintingCode: "PTG-THIN-WASH",
        paintingName: "Washing Thinner PP",
        packaging: "Pail 15 kg",
        notes: "Area Cuci Jig",
      },
      {
        paintingCode: "PTG-EPX-BLK",
        paintingName: "Epoxy Primer Black",
        packaging: "Drum 200 L",
        notes: "Undercoat line 1",
      },
    ];

    sampleRows.forEach((item, idx) => {
      const row = wsInput.addRow({
        paintingCode: item.paintingCode,
        paintingName: item.paintingName,
        packaging: item.packaging,
        notes: item.notes,
      });
      row.height = 22;
      row.eachCell((cell, col) => {
        cell.font = { size: 10, color: { argb: "FF334155" } };
        cell.alignment = { vertical: "middle", horizontal: col === 1 ? "center" : "left" };
        if (col === 1) {
          cell.font = { bold: true, name: "Consolas", color: { argb: "FF0F766E" } };
        }
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    // ── SHEET 2: Referensi Master Item PRMS (Untuk Panduan Pengguna) ────────
    const wsRef = workbook.addWorksheet("Referensi Master Item PRMS", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    });

    wsRef.columns = [
      { header: "Kode Purchasing (PRMS)", key: "code", width: 22 },
      { header: "Kode Painting Terdaftar", key: "paintingCode", width: 24 },
      { header: "Nama Barang (Master PRMS)", key: "name", width: 45 },
      { header: "Kemasan", key: "packageUnit", width: 14 },
      { header: "Isi per Kemasan", key: "packageSize", width: 16 },
      { header: "Satuan Bobot", key: "unit", width: 14 },
    ];

    const refHeaderRow = wsRef.getRow(1);
    refHeaderRow.height = 26;
    refHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" }, // Slate 800
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        bottom: { style: "medium", color: { argb: "FF0284C7" } },
      };
    });

    masterItems.forEach((item) => {
      const row = wsRef.addRow({
        code: item.code,
        paintingCode: item.paintingCode || "—",
        name: item.name,
        packageUnit: item.packageUnit || "—",
        packageSize: item.packageSize ? Number(item.packageSize) : "—",
        unit: item.unit || "—",
      });
      row.height = 20;
      row.eachCell((cell, col) => {
        cell.font = { size: 9, color: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: col === 1 || col === 2 ? "center" : "left" };
        if (col === 1) {
          cell.font = { bold: true, name: "Consolas", color: { argb: "FF1D4ED8" } };
        }
        if (col === 2 && item.paintingCode) {
          cell.font = { bold: true, name: "Consolas", color: { argb: "FF0F766E" } };
        }
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFF1F5F9" } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Template_Rekonsiliasi_Kode_Painting.xlsx"',
      },
    });
  } catch (error: any) {
    console.error("Error generating painting template:", error);
    return NextResponse.json(
      { error: error?.message || "Gagal membuat template Excel" },
      { status: 500 }
    );
  }
}
