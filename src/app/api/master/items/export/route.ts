import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.item.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        paintingCode: true,
        name: true,
        unit: true,
        packageUnit: true,
        packageSize: true,
        lastUnitPrice: true,
        isActive: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PRMS Purchasing System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Master Item");

    // Freeze header row
    worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    // Define columns
    worksheet.columns = [
      { header: "ID Item (Sistem - Jangan Diubah)", key: "id", width: 32 },
      { header: "Kode Sekarang", key: "currentCode", width: 20 },
      { header: "Kode Painting (Gudang)", key: "paintingCode", width: 24 },
      { header: "Kode Baru (Isi Kode Standar di Sini)", key: "newCode", width: 30 },
      { header: "Nama Barang (Tetap Dipertahankan dari PO)", key: "name", width: 45 },
      { header: "Satuan Dasar", key: "unit", width: 14 },
      { header: "Kemasan", key: "packageUnit", width: 14 },
      { header: "Isi Kemasan", key: "packageSize", width: 14 },
      { header: "Harga Terkini (Rp)", key: "lastUnitPrice", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      
      // Beri warna khusus pada kolom "Kode Baru" agar user langsung tahu di mana harus mengisi
      if (colNumber === 4) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E40AF" }, // Biru pekat
        };
      } else if (colNumber === 3) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0D9488" }, // Teal untuk Kode Painting
        };
      } else if (colNumber === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF64748B" }, // Slate
        };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F172A" }, // Hitam/Gelap
        };
      }
    });

    // Populate data
    for (const item of items) {
      const row = worksheet.addRow({
        id: item.id,
        currentCode: item.code,
        paintingCode: item.paintingCode || "",
        newCode: "", // Kosongkan agar pengguna bisa mengisi kode baru dengan mudah
        name: item.name,
        unit: item.unit || "kg",
        packageUnit: item.packageUnit || "-",
        packageSize: item.packageSize ? Number(item.packageSize) : 1,
        lastUnitPrice: item.lastUnitPrice ? Number(item.lastUnitPrice) : 0,
        status: item.isActive ? "AKTIF" : "NONAKTIF",
      });

      row.height = 22;
      row.alignment = { vertical: "middle" };

      // Format alignment per cell
      row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(4).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(6).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(8).alignment = { vertical: "middle", horizontal: "right" };
      row.getCell(9).alignment = { vertical: "middle", horizontal: "right" };
      row.getCell(10).alignment = { vertical: "middle", horizontal: "center" };

      // Highlight cell Kode Baru dengan border tipis dan background lembut
      const newCodeCell = row.getCell(4);
      newCodeCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F9FF" }, // Light sky
      };
      newCodeCell.font = { bold: true, color: { argb: "FF1E3A8A" } };

      // Format angka harga
      row.getCell(8).numFmt = "#,##0";
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `master-item-prms-${timestamp}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Export Master Item error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengekspor data item" }, { status: 500 });
  }
}
