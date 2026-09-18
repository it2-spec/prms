import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "PURCHASING" && session.role !== "WAREHOUSE")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const warehouseId = url.searchParams.get("warehouseId");
  const unitMode = url.searchParams.get("unitMode") || "package";
  const isBase = unitMode === "base";

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const warehouseFilter = warehouseId && warehouseId !== "all" ? { warehouseId } : {};

  let warehouseName = "Semua Gudang";
  if (warehouseId && warehouseId !== "all") {
    const wh = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { name: true },
    });
    if (wh) warehouseName = wh.name;
  }

  // 1. Ambil semua item aktif
  const allItems = await prisma.item.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  // 2. Hitung Stok Awal historis sebelum startDate
  const incomingBefore = await prisma.receivingDetail.findMany({
    where: {
      receiving: {
        status: { in: ["VERIFIED", "RECEIVED", "CLOSED"] },
        receivedAt: { lt: startDate },
        ...warehouseFilter,
      },
    },
    select: {
      itemId: true,
      qtyReceived: true,
      item: { select: { packageSize: true } },
    },
  });

  const incomingBeforeMap = new Map<string, number>();
  for (const ib of incomingBefore) {
    const pkgSize = Number(ib.item?.packageSize ?? 1);
    const pkgQty = pkgSize > 0 ? ib.qtyReceived / pkgSize : ib.qtyReceived;
    incomingBeforeMap.set(ib.itemId, (incomingBeforeMap.get(ib.itemId) || 0) + pkgQty);
  }

  const outgoingBefore = await prisma.stockOutgoingDetail.findMany({
    where: {
      stockOutgoing: {
        status: "COMPLETED",
        issuedAt: { lt: startDate },
        ...warehouseFilter,
      },
    },
    select: {
      itemId: true,
      packageQty: true,
    },
  });

  const outgoingBeforeMap = new Map<string, number>();
  for (const ob of outgoingBefore) {
    outgoingBeforeMap.set(ob.itemId, (outgoingBeforeMap.get(ob.itemId) || 0) + ob.packageQty);
  }

  // 3. Ambil Mutasi Incoming Bulan Berjalan
  const receivings = await prisma.receiving.findMany({
    where: {
      status: { in: ["VERIFIED", "RECEIVED", "CLOSED"] },
      receivedAt: { gte: startDate, lte: endDate },
      ...warehouseFilter,
    },
    orderBy: { receivedAt: "asc" },
    include: {
      warehouse: true,
      purchaseOrder: { include: { supplier: true } },
      details: { include: { item: true } },
    },
  });

  // 4. Ambil Mutasi Outgoing Bulan Berjalan
  const outgoings = await prisma.stockOutgoing.findMany({
    where: {
      status: "COMPLETED",
      issuedAt: { gte: startDate, lte: endDate },
      ...warehouseFilter,
    },
    orderBy: { issuedAt: "asc" },
    include: {
      warehouse: true,
      createdBy: true,
      details: { include: { item: true } },
    },
  });

  // 5. Strukturkan data per item
  interface ExportItem {
    itemId: string;
    itemCode: string;
    itemName: string;
    unit: string;
    packageUnit: string;
    packageSize: number;
    initialStockPkgQty: number;
    initialStockBaseQty: number;
    totalInPkgQty: number;
    totalInBaseQty: number;
    totalOutPkgQty: number;
    totalOutBaseQty: number;
    balancePkgQty: number;
    balanceBaseQty: number;
    dailyIn: Record<number, number>;
    dailyOut: Record<number, number>;
    dailyInBase: Record<number, number>;
    dailyOutBase: Record<number, number>;
  }

  const itemMap = new Map<string, ExportItem>();

  for (const item of allItems) {
    const pkgSize = Number(item.packageSize ?? 1);
    const inB = incomingBeforeMap.get(item.id) || 0;
    const outB = outgoingBeforeMap.get(item.id) || 0;
    const initialStock = Math.max(0, Math.round((inB - outB) * 100) / 100);
    const initialStockBase = Math.round(initialStock * pkgSize * 100) / 100;

    itemMap.set(item.id, {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      unit: item.unit || "kg",
      packageUnit: item.packageUnit || "Pail",
      packageSize: pkgSize,
      initialStockPkgQty: initialStock,
      initialStockBaseQty: initialStockBase,
      totalInPkgQty: 0,
      totalInBaseQty: 0,
      totalOutPkgQty: 0,
      totalOutBaseQty: 0,
      balancePkgQty: initialStock,
      balanceBaseQty: initialStockBase,
      dailyIn: {},
      dailyOut: {},
      dailyInBase: {},
      dailyOutBase: {},
    });
  }

  // Agregasi Incoming
  for (const rcv of receivings) {
    const dateStr = rcv.receivedAt.toISOString().split("T")[0];
    const dayNumber = parseInt(dateStr.split("-")[2], 10);

    for (const dt of rcv.details) {
      if (!dt.item) continue;
      const entry = itemMap.get(dt.itemId);
      if (!entry) continue;

      const pkgSize = entry.packageSize > 0 ? entry.packageSize : 1;
      const pkgQty = Math.round((dt.qtyReceived / pkgSize) * 100) / 100;

      entry.totalInBaseQty = Math.round((entry.totalInBaseQty + dt.qtyReceived) * 100) / 100;
      entry.totalInPkgQty = Math.round((entry.totalInPkgQty + pkgQty) * 100) / 100;
      entry.dailyIn[dayNumber] = Math.round(((entry.dailyIn[dayNumber] || 0) + pkgQty) * 100) / 100;
      entry.dailyInBase[dayNumber] = Math.round(((entry.dailyInBase[dayNumber] || 0) + dt.qtyReceived) * 100) / 100;
    }
  }

  // Agregasi Outgoing
  for (const out of outgoings) {
    const dateStr = out.issuedAt.toISOString().split("T")[0];
    const dayNumber = parseInt(dateStr.split("-")[2], 10);

    for (const dt of out.details) {
      if (!dt.item) continue;
      const entry = itemMap.get(dt.itemId);
      if (!entry) continue;

      const pkgQty = dt.packageQty;
      const baseQty = Number(dt.baseQty);

      entry.totalOutBaseQty = Math.round((entry.totalOutBaseQty + baseQty) * 100) / 100;
      entry.totalOutPkgQty = Math.round((entry.totalOutPkgQty + pkgQty) * 100) / 100;
      entry.dailyOut[dayNumber] = Math.round(((entry.dailyOut[dayNumber] || 0) + pkgQty) * 100) / 100;
      entry.dailyOutBase[dayNumber] = Math.round(((entry.dailyOutBase[dayNumber] || 0) + baseQty) * 100) / 100;
    }
  }

  // Filter hanya item yang aktif (ada stok awal atau mutasi)
  const activeItems: ExportItem[] = [];
  for (const entry of itemMap.values()) {
    entry.balancePkgQty = Math.max(
      0,
      Math.round((entry.initialStockPkgQty + entry.totalInPkgQty - entry.totalOutPkgQty) * 100) / 100
    );
    entry.balanceBaseQty = Math.max(
      0,
      Math.round((entry.initialStockBaseQty + entry.totalInBaseQty - entry.totalOutBaseQty) * 100) / 100
    );
    if (entry.initialStockPkgQty > 0 || entry.totalInPkgQty > 0 || entry.totalOutPkgQty > 0) {
      activeItems.push(entry);
    }
  }
  activeItems.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PRMS System";
  workbook.created = new Date();

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const periodLabel = `${monthNames[month]} ${year}`;

  // ==================== SHEET 1: MATRIKS KALENDER (2 BARIS PER ITEM) ====================
  const sheetMatrix = workbook.addWorksheet("Matriks Mutasi Material");

  // Title Info
  sheetMatrix.mergeCells(`A1:${String.fromCharCode(65 + 6 + daysInMonth)}1`);
  const titleCell = sheetMatrix.getCell("A1");
  titleCell.value = `KARTU MATRIKS MUTASI STOK MATERIAL (${isBase ? "SATUAN DASAR" : "SATUAN KEMASAN"}) - ${periodLabel.toUpperCase()}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FF1E293B" } };
  titleCell.alignment = { vertical: "middle" };

  sheetMatrix.getCell("A2").value = `Gudang: ${warehouseName} | Satuan Angka: ${isBase ? "Satuan Dasar (kg, ltr, pcs, dll)" : "Satuan Kemasan (Pail, Can, Drum, dll)"} | Rumus: Stok Awal + Masuk - Keluar = Stok Akhir`;
  sheetMatrix.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  // Headers: No | Kode Item | Nama Material | Satuan | Stok Awal | Tipe | 1..daysInMonth | Total Mutasi | Stok Akhir
  const matrixHeaders: (string | number)[] = [
    "No",
    "Kode Item",
    "Nama Material",
    "Satuan",
    "Stok Awal",
    "Tipe",
  ];
  for (let d = 1; d <= daysInMonth; d++) {
    matrixHeaders.push(d);
  }
  matrixHeaders.push("Total Mutasi");
  matrixHeaders.push("Stok Akhir");

  const headerRow = sheetMatrix.addRow(matrixHeaders);
  headerRow.height = 24;

  const totalMutasiCol = 7 + daysInMonth;
  const stokAkhirCol = 8 + daysInMonth;

  headerRow.eachCell((cell, colNumber) => {
    const isDateCol = colNumber >= 7 && colNumber <= 6 + daysInMonth;
    let isWeekend = false;
    if (isDateCol) {
      const d = colNumber - 6;
      const dayDate = new Date(year, month, d);
      const dayOfWeek = dayDate.getDay();
      isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    }

    let fgColor = isWeekend ? "FFDC2626" : "FF1E3A8A";
    if (colNumber === totalMutasiCol) fgColor = "FF334155";
    if (colNumber === stokAkhirCol) fgColor = "FF065F46";

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fgColor },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Isi data 2 baris per item
  let currentRowNum = 4; // Row 1 title, Row 2 subtitle, Row 3 header
  activeItems.forEach((item, index) => {
    const initialVal = isBase ? item.initialStockBaseQty : item.initialStockPkgQty;
    const balanceVal = isBase ? item.balanceBaseQty : item.balancePkgQty;
    const unitVal = isBase ? item.unit : item.packageUnit;
    const totalInVal = isBase ? item.totalInBaseQty : item.totalInPkgQty;
    const totalOutVal = isBase ? item.totalOutBaseQty : item.totalOutPkgQty;

    // Baris 1: IN
    const rowIn: (string | number)[] = [
      index + 1,
      item.itemCode,
      item.itemName,
      unitVal,
      initialVal,
      "IN",
    ];
    for (let d = 1; d <= daysInMonth; d++) {
      const q = isBase ? item.dailyInBase[d] : item.dailyIn[d];
      rowIn.push(q ? q : "");
    }
    rowIn.push(totalInVal);
    rowIn.push(balanceVal);

    const rIn = sheetMatrix.addRow(rowIn);
    rIn.height = 19;

    // Baris 2: OUT
    const rowOut: (string | number)[] = [
      "",
      "",
      "",
      "",
      "",
      "OUT",
    ];
    for (let d = 1; d <= daysInMonth; d++) {
      const q = isBase ? item.dailyOutBase[d] : item.dailyOut[d];
      rowOut.push(q ? q : "");
    }
    rowOut.push(totalOutVal);
    rowOut.push("");

    const rOut = sheetMatrix.addRow(rowOut);
    rOut.height = 19;

    // Styling Baris IN
    rIn.eachCell((cell, colNumber) => {
      const isDateCol = colNumber >= 7 && colNumber <= 6 + daysInMonth;
      let isWeekend = false;
      if (isDateCol) {
        const d = colNumber - 6;
        const dayDate = new Date(year, month, d);
        const dayOfWeek = dayDate.getDay();
        isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (colNumber === 6) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { bold: true, color: { argb: "FF047857" }, size: 9 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
      } else if (colNumber === totalMutasiCol) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { bold: true, color: { argb: "FF047857" }, size: 9 };
      } else if (colNumber === stokAkhirCol) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { bold: true, color: { argb: "FF065F46" }, size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6FFFA" } };
      } else if (isDateCol) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (cell.value && Number(cell.value) > 0) {
          cell.font = { bold: true, color: { argb: isWeekend ? "FFB91C1C" : "FF047857" }, size: 9 };
        }
        if (isWeekend) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF2F2" } };
        }
      }
    });

    // Styling Baris OUT
    rOut.eachCell((cell, colNumber) => {
      const isDateCol = colNumber >= 7 && colNumber <= 6 + daysInMonth;
      let isWeekend = false;
      if (isDateCol) {
        const d = colNumber - 6;
        const dayDate = new Date(year, month, d);
        const dayOfWeek = dayDate.getDay();
        isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (colNumber === 6) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { bold: true, color: { argb: "FFC2410C" }, size: 9 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
      } else if (colNumber === totalMutasiCol) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { bold: true, color: { argb: "FFC2410C" }, size: 9 };
      } else if (isDateCol) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (cell.value && Number(cell.value) > 0) {
          cell.font = { bold: true, color: { argb: isWeekend ? "FFB91C1C" : "FFC2410C" }, size: 9 };
        }
        if (isWeekend) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF2F2" } };
        }
      }
    });

    // Vertically merge No, Kode, Nama, Satuan, Stok Awal, dan Stok Akhir
    const startRow = currentRowNum;
    sheetMatrix.mergeCells(startRow, 1, startRow + 1, 1); // No
    sheetMatrix.mergeCells(startRow, 2, startRow + 1, 2); // Kode
    sheetMatrix.mergeCells(startRow, 3, startRow + 1, 3); // Nama
    sheetMatrix.mergeCells(startRow, 4, startRow + 1, 4); // Satuan
    sheetMatrix.mergeCells(startRow, 5, startRow + 1, 5); // Stok Awal
    sheetMatrix.mergeCells(startRow, stokAkhirCol, startRow + 1, stokAkhirCol); // Stok Akhir

    // Alignment sel merged
    sheetMatrix.getCell(startRow, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheetMatrix.getCell(startRow, 2).alignment = { vertical: "middle" };
    sheetMatrix.getCell(startRow, 3).alignment = { vertical: "middle" };
    sheetMatrix.getCell(startRow, 4).alignment = { horizontal: "center", vertical: "middle" };
    sheetMatrix.getCell(startRow, 5).alignment = { horizontal: "center", vertical: "middle" };
    sheetMatrix.getCell(startRow, stokAkhirCol).alignment = { horizontal: "center", vertical: "middle" };

    currentRowNum += 2;
  });

  // Baris Grand Total IN
  const grandInRowData: (string | number)[] = ["", "GRAND TOTAL", "", "", "", "IN"];
  let grandTotalMasuk = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const sumDay = activeItems.reduce(
      (acc, it) => acc + (isBase ? (it.dailyInBase[d] || 0) : (it.dailyIn[d] || 0)),
      0
    );
    grandInRowData.push(sumDay > 0 ? Math.round(sumDay * 100) / 100 : "");
    grandTotalMasuk += sumDay;
  }
  grandInRowData.push(Math.round(grandTotalMasuk * 100) / 100);
  const totalBalanceAll = activeItems.reduce(
    (acc, it) => acc + (isBase ? it.balanceBaseQty : it.balancePkgQty),
    0
  );
  grandInRowData.push(Math.round(totalBalanceAll * 100) / 100);

  const grandInRow = sheetMatrix.addRow(grandInRowData);
  grandInRow.height = 22;

  // Baris Grand Total OUT
  const grandOutRowData: (string | number)[] = ["", "", "", "", "", "OUT"];
  let grandTotalKeluar = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const sumDay = activeItems.reduce(
      (acc, it) => acc + (isBase ? (it.dailyOutBase[d] || 0) : (it.dailyOut[d] || 0)),
      0
    );
    grandOutRowData.push(sumDay > 0 ? Math.round(sumDay * 100) / 100 : "");
    grandTotalKeluar += sumDay;
  }
  grandOutRowData.push(Math.round(grandTotalKeluar * 100) / 100);
  grandOutRowData.push("");

  const grandOutRow = sheetMatrix.addRow(grandOutRowData);
  grandOutRow.height = 22;

  // Merge label Grand Total dan Saldo Akhir
  sheetMatrix.mergeCells(currentRowNum, 2, currentRowNum + 1, 5);
  sheetMatrix.getCell(currentRowNum, 2).value = `GRAND TOTAL MUTASI (${isBase ? "SATUAN DASAR" : "KEMASAN"})`;
  sheetMatrix.getCell(currentRowNum, 2).alignment = { vertical: "middle", horizontal: "center" };
  sheetMatrix.getCell(currentRowNum, 2).font = { bold: true, size: 9 };

  sheetMatrix.mergeCells(currentRowNum, stokAkhirCol, currentRowNum + 1, stokAkhirCol);
  sheetMatrix.getCell(currentRowNum, stokAkhirCol).alignment = { vertical: "middle", horizontal: "center" };
  sheetMatrix.getCell(currentRowNum, stokAkhirCol).font = { bold: true, size: 10, color: { argb: "FF065F46" } };

  // Set Widths
  sheetMatrix.getColumn(1).width = 5;
  sheetMatrix.getColumn(2).width = 14;
  sheetMatrix.getColumn(3).width = 30;
  sheetMatrix.getColumn(4).width = 10;
  sheetMatrix.getColumn(5).width = 12;
  sheetMatrix.getColumn(6).width = 6;
  for (let d = 1; d <= daysInMonth; d++) {
    sheetMatrix.getColumn(6 + d).width = 6;
  }
  sheetMatrix.getColumn(totalMutasiCol).width = 14;
  sheetMatrix.getColumn(stokAkhirCol).width = 14;

  // ==================== SHEET 2: DETAIL TRANSAKSI MASUK ====================
  const sheetDetailIn = workbook.addWorksheet("Log Kedatangan (IN)");
  const detailInHeaders = [
    "No",
    "Tanggal Datang",
    "No. Receiving",
    "No. PO",
    "Supplier",
    "Gudang",
    "Kode Item",
    "Nama Material",
    "Qty (Kemasan)",
    "Satuan Kemasan",
    "Qty (Dasar)",
    "Satuan Dasar",
  ];

  const detailInHeaderRow = sheetDetailIn.addRow(detailInHeaders);
  detailInHeaderRow.height = 22;
  detailInHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF065F46" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  let inIdx = 1;
  for (const rcv of receivings) {
    const dateStr = rcv.receivedAt.toISOString().split("T")[0];
    for (const dt of rcv.details) {
      if (!dt.item) continue;
      const pkgSize = Number(dt.item.packageSize ?? 1);
      const pkgQty = pkgSize > 0 ? Math.round((dt.qtyReceived / pkgSize) * 100) / 100 : dt.qtyReceived;

      sheetDetailIn.addRow([
        inIdx++,
        dateStr,
        rcv.receivingNumber,
        rcv.purchaseOrder.poNumber,
        rcv.purchaseOrder.supplier.name,
        rcv.warehouse.name,
        dt.item.code,
        dt.item.name,
        pkgQty,
        dt.item.packageUnit || "Pail",
        dt.qtyReceived,
        dt.item.unit || "kg",
      ]);
    }
  }

  sheetDetailIn.columns = [
    { width: 5 },
    { width: 13 },
    { width: 18 },
    { width: 20 },
    { width: 24 },
    { width: 16 },
    { width: 14 },
    { width: 30 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ];

  // ==================== SHEET 3: DETAIL TRANSAKSI KELUAR ====================
  const sheetDetailOut = workbook.addWorksheet("Log Pengeluaran (OUT)");
  const detailOutHeaders = [
    "No",
    "Tanggal Keluar",
    "No. Outgoing",
    "Gudang",
    "Kode Item",
    "Nama Material",
    "Qty (Kemasan)",
    "Satuan Kemasan",
    "Qty (Dasar)",
    "Satuan Dasar",
    "Departemen",
    "Tujuan / Keterangan",
    "Petugas",
  ];

  const detailOutHeaderRow = sheetDetailOut.addRow(detailOutHeaders);
  detailOutHeaderRow.height = 22;
  detailOutHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC2410C" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  let outIdx = 1;
  for (const out of outgoings) {
    const dateStr = out.issuedAt.toISOString().split("T")[0];
    for (const dt of out.details) {
      if (!dt.item) continue;
      sheetDetailOut.addRow([
        outIdx++,
        dateStr,
        out.outgoingNumber,
        out.warehouse.name,
        dt.item.code,
        dt.item.name,
        dt.packageQty,
        dt.item.packageUnit || "Pail",
        Number(dt.baseQty),
        dt.item.unit || "kg",
        out.department || "-",
        out.purpose || "-",
        out.createdBy?.name || "-",
      ]);
    }
  }

  sheetDetailOut.columns = [
    { width: 5 },
    { width: 13 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 30 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 26 },
    { width: 16 },
  ];

  const buf = await workbook.xlsx.writeBuffer();
  const filename = `Matriks_Mutasi_Stok_${isBase ? "Satuan" : "Kemasan"}_${year}_${String(month + 1).padStart(2, "0")}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
