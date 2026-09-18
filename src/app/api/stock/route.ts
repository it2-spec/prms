import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "PURCHASING" && session.role !== "WAREHOUSE")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // "YYYY-MM"
  const warehouseId = searchParams.get("warehouseId");
  const search = searchParams.get("search")?.toLowerCase().trim();

  // Tentukan periode bulan terpilih
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Filter gudang
  const warehouseFilter = warehouseId && warehouseId !== "all" ? { warehouseId } : {};

  // 1. Ambil semua Item aktif
  const allItems = await prisma.item.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  // 2. Hitung Stok Awal Historis (sebelum startDate)
  // 2a. Total Incoming historis (receivedAt < startDate)
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
      item: {
        select: { packageSize: true },
      },
    },
  });

  const incomingBeforeMap = new Map<string, number>();
  for (const ib of incomingBefore) {
    const pkgSize = Number(ib.item?.packageSize ?? 1);
    const pkgQty = pkgSize > 0 ? ib.qtyReceived / pkgSize : ib.qtyReceived;
    incomingBeforeMap.set(ib.itemId, (incomingBeforeMap.get(ib.itemId) || 0) + pkgQty);
  }

  // 2b. Total Outgoing historis (issuedAt < startDate)
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

  // 3. Ambil Mutasi Incoming Bulan Berjalan (startDate s.d. endDate)
  const receivings = await prisma.receiving.findMany({
    where: {
      status: { in: ["VERIFIED", "RECEIVED", "CLOSED"] },
      receivedAt: { gte: startDate, lte: endDate },
      ...warehouseFilter,
    },
    orderBy: { receivedAt: "asc" },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      purchaseOrder: {
        select: {
          poNumber: true,
          supplier: { select: { name: true } },
        },
      },
      details: {
        include: { item: true },
      },
    },
  });

  // 4. Ambil Mutasi Outgoing Bulan Berjalan (startDate s.d. endDate)
  const outgoings = await prisma.stockOutgoing.findMany({
    where: {
      status: "COMPLETED",
      issuedAt: { gte: startDate, lte: endDate },
      ...warehouseFilter,
    },
    orderBy: { issuedAt: "asc" },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { name: true } },
      details: {
        include: { item: true },
      },
    },
  });

  // 5. Strukturkan per Item
  interface ItemStockAggregate {
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
    dailyIn: Record<number, number>; // Satuan Kemasan
    dailyOut: Record<number, number>; // Satuan Kemasan
    dailyInBase: Record<number, number>; // Satuan Dasar (kg/ltr)
    dailyOutBase: Record<number, number>; // Satuan Dasar (kg/ltr)
    dailyInDetails: Record<number, Array<{
      receivingNumber: string;
      poNumber: string;
      supplierName: string;
      packageQty: number;
      baseQty: number;
    }>>;
    dailyOutDetails: Record<number, Array<{
      outgoingNumber: string;
      purpose?: string | null;
      department?: string | null;
      createdByName?: string;
      packageQty: number;
      baseQty: number;
    }>>;
  }

  const itemMap = new Map<string, ItemStockAggregate>();

  // Inisialisasi setiap item dari master
  for (const item of allItems) {
    if (search) {
      const matchCode = item.code.toLowerCase().includes(search);
      const matchName = item.name.toLowerCase().includes(search);
      if (!matchCode && !matchName) continue;
    }

    const pkgSize = Number(item.packageSize ?? 1);
    const inBefore = incomingBeforeMap.get(item.id) || 0;
    const outBefore = outgoingBeforeMap.get(item.id) || 0;
    const initialStock = Math.max(0, Math.round((inBefore - outBefore) * 100) / 100);
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
      dailyInDetails: {},
      dailyOutDetails: {},
    });
  }

  // Agregasi Incoming bulan ini
  for (const rcv of receivings) {
    const dateStr = rcv.receivedAt.toISOString().split("T")[0];
    const dayNumber = parseInt(dateStr.split("-")[2], 10);

    for (const dt of rcv.details) {
      if (!dt.item) continue;
      const entry = itemMap.get(dt.itemId);
      if (!entry) continue;

      const pkgSize = entry.packageSize > 0 ? entry.packageSize : 1;
      const calculatedPkgQty = Math.round((dt.qtyReceived / pkgSize) * 100) / 100;

      entry.totalInBaseQty = Math.round((entry.totalInBaseQty + dt.qtyReceived) * 100) / 100;
      entry.totalInPkgQty = Math.round((entry.totalInPkgQty + calculatedPkgQty) * 100) / 100;
      entry.dailyIn[dayNumber] = Math.round(((entry.dailyIn[dayNumber] || 0) + calculatedPkgQty) * 100) / 100;
      entry.dailyInBase[dayNumber] = Math.round(((entry.dailyInBase[dayNumber] || 0) + dt.qtyReceived) * 100) / 100;

      if (!entry.dailyInDetails[dayNumber]) {
        entry.dailyInDetails[dayNumber] = [];
      }
      entry.dailyInDetails[dayNumber].push({
        receivingNumber: rcv.receivingNumber,
        poNumber: rcv.purchaseOrder.poNumber,
        supplierName: rcv.purchaseOrder.supplier.name,
        packageQty: calculatedPkgQty,
        baseQty: dt.qtyReceived,
      });
    }
  }

  // Agregasi Outgoing bulan ini
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

      if (!entry.dailyOutDetails[dayNumber]) {
        entry.dailyOutDetails[dayNumber] = [];
      }
      entry.dailyOutDetails[dayNumber].push({
        outgoingNumber: out.outgoingNumber,
        purpose: out.purpose,
        department: out.department,
        createdByName: out.createdBy?.name,
        packageQty: pkgQty,
        baseQty: baseQty,
      });
    }
  }

  // Hitung Saldo Akhir dan Filter Item Aktif
  const activeItems: ItemStockAggregate[] = [];
  for (const entry of itemMap.values()) {
    // Formula: Stok Akhir = Stok Awal + Total Masuk - Total Keluar
    entry.balancePkgQty = Math.max(
      0,
      Math.round((entry.initialStockPkgQty + entry.totalInPkgQty - entry.totalOutPkgQty) * 100) / 100
    );
    entry.balanceBaseQty = Math.max(
      0,
      Math.round((entry.initialStockBaseQty + entry.totalInBaseQty - entry.totalOutBaseQty) * 100) / 100
    );

    // Tampilkan jika ada stok awal > 0 ATAU ada masuk > 0 ATAU ada keluar > 0 ATAU user melakukan pencarian spesifik
    if (
      search ||
      entry.initialStockPkgQty > 0 ||
      entry.totalInPkgQty > 0 ||
      entry.totalOutPkgQty > 0
    ) {
      activeItems.push(entry);
    }
  }

  // Sort berdasarkan kode item
  activeItems.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

  // Hitung Grand Total Harian untuk Baris Footer
  const dailyGrandTotal = {
    inPkg: {} as Record<number, number>,
    outPkg: {} as Record<number, number>,
    inBase: {} as Record<number, number>,
    outBase: {} as Record<number, number>,
    in: {} as Record<number, number>, // Alias untuk backwards compatibility
    out: {} as Record<number, number>, // Alias untuk backwards compatibility
  };

  for (let d = 1; d <= daysInMonth; d++) {
    let sumInPkg = 0;
    let sumOutPkg = 0;
    let sumInBase = 0;
    let sumOutBase = 0;

    for (const it of activeItems) {
      sumInPkg += it.dailyIn[d] || 0;
      sumOutPkg += it.dailyOut[d] || 0;
      sumInBase += it.dailyInBase[d] || 0;
      sumOutBase += it.dailyOutBase[d] || 0;
    }

    dailyGrandTotal.inPkg[d] = Math.round(sumInPkg * 100) / 100;
    dailyGrandTotal.outPkg[d] = Math.round(sumOutPkg * 100) / 100;
    dailyGrandTotal.inBase[d] = Math.round(sumInBase * 100) / 100;
    dailyGrandTotal.outBase[d] = Math.round(sumOutBase * 100) / 100;
    dailyGrandTotal.in[d] = dailyGrandTotal.inPkg[d];
    dailyGrandTotal.out[d] = dailyGrandTotal.outPkg[d];
  }

  // Summary statistics
  const summary = {
    totalItems: activeItems.length,
    totalReceivings: receivings.length,
    totalOutgoings: outgoings.length,
    totalInitialStockPkgQty: Math.round(activeItems.reduce((s, it) => s + it.initialStockPkgQty, 0) * 100) / 100,
    totalInitialStockBaseQty: Math.round(activeItems.reduce((s, it) => s + it.initialStockBaseQty, 0) * 100) / 100,
    totalInPkgQty: Math.round(activeItems.reduce((s, it) => s + it.totalInPkgQty, 0) * 100) / 100,
    totalInBaseQty: Math.round(activeItems.reduce((s, it) => s + it.totalInBaseQty, 0) * 100) / 100,
    totalOutPkgQty: Math.round(activeItems.reduce((s, it) => s + it.totalOutPkgQty, 0) * 100) / 100,
    totalOutBaseQty: Math.round(activeItems.reduce((s, it) => s + it.totalOutBaseQty, 0) * 100) / 100,
    totalBalancePkgQty: Math.round(activeItems.reduce((s, it) => s + it.balancePkgQty, 0) * 100) / 100,
    totalBalanceBaseQty: Math.round(activeItems.reduce((s, it) => s + it.balanceBaseQty, 0) * 100) / 100,
  };

  return NextResponse.json({
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    daysInMonth,
    warehouseId: warehouseId || "all",
    summary,
    dailyGrandTotal,
    items: activeItems,
  });
}
