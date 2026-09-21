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
  const itemCode = searchParams.get("itemCode")?.trim();
  const warehouseId = searchParams.get("warehouseId");

  if (!itemCode) {
    return NextResponse.json({ error: "itemCode wajib diisi" }, { status: 400 });
  }

  const item = await prisma.item.findFirst({
    where: {
      OR: [
        { code: { equals: itemCode, mode: "insensitive" } },
        { paintingCode: { equals: itemCode, mode: "insensitive" } },
      ],
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      paintingCode: true,
      name: true,
      unit: true,
      packageUnit: true,
      packageSize: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: `Item dengan kode/painting "${itemCode}" tidak ditemukan` }, { status: 404 });
  }

  const pkgSize = Number(item.packageSize ?? 1) || 1;

  // Hitung total incoming (status VERIFIED, RECEIVED, CLOSED)
  const receivingWhere: Record<string, unknown> = {
    itemId: item.id,
    receiving: {
      status: { in: ["VERIFIED", "RECEIVED", "CLOSED"] },
    },
  };
  if (warehouseId && warehouseId !== "all") {
    receivingWhere.receiving = {
      status: { in: ["VERIFIED", "RECEIVED", "CLOSED"] },
      warehouseId,
    };
  }

  const receivingAgg = await prisma.receivingDetail.aggregate({
    where: receivingWhere as Parameters<typeof prisma.receivingDetail.aggregate>[0]["where"],
    _sum: { qtyReceived: true },
  });
  const totalIncomingBase = Number(receivingAgg._sum.qtyReceived ?? 0);
  const totalIncomingPkg = totalIncomingBase / pkgSize;

  // Hitung total outgoing (hanya status COMPLETED)
  const outgoingWhere: Record<string, unknown> = {
    itemId: item.id,
    stockOutgoing: {
      status: "COMPLETED",
    },
  };
  if (warehouseId && warehouseId !== "all") {
    outgoingWhere.stockOutgoing = {
      warehouseId,
      status: "COMPLETED",
    };
  }

  const outgoingAgg = await prisma.stockOutgoingDetail.aggregate({
    where: outgoingWhere as Parameters<typeof prisma.stockOutgoingDetail.aggregate>[0]["where"],
    _sum: { packageQty: true },
  });
  const totalOutgoingPkg = Number(outgoingAgg._sum.packageQty ?? 0);

  const balancePkg = Math.max(0, totalIncomingPkg - totalOutgoingPkg);

  // Jika gudang spesifik dipilih, cari juga ketersediaan di gudang lain
  const otherWarehouses: Array<{
    warehouseId: string;
    warehouseName: string;
    balancePkgQty: number;
  }> = [];

  if (warehouseId && warehouseId !== "all") {
    const allReceivings = await prisma.receivingDetail.findMany({
      where: {
        itemId: item.id,
        receiving: {
          status: { in: ["VERIFIED", "RECEIVED", "CLOSED"] },
          warehouseId: { not: warehouseId },
        },
      },
      select: {
        qtyReceived: true,
        receiving: { select: { warehouseId: true, warehouse: { select: { name: true } } } },
      },
    });

    const allOutgoings = await prisma.stockOutgoingDetail.findMany({
      where: {
        itemId: item.id,
        stockOutgoing: {
          status: "COMPLETED",
          warehouseId: { not: warehouseId },
        },
      },
      select: {
        packageQty: true,
        stockOutgoing: { select: { warehouseId: true, warehouse: { select: { name: true } } } },
      },
    });

    const whMap = new Map<string, { name: string; incoming: number; outgoing: number }>();
    for (const r of allReceivings) {
      const wid = r.receiving.warehouseId;
      const wname = r.receiving.warehouse?.name || "Gudang Lain";
      const cur = whMap.get(wid) || { name: wname, incoming: 0, outgoing: 0 };
      cur.incoming += Number(r.qtyReceived || 0);
      whMap.set(wid, cur);
    }
    for (const o of allOutgoings) {
      const wid = o.stockOutgoing.warehouseId;
      const wname = o.stockOutgoing.warehouse?.name || "Gudang Lain";
      const cur = whMap.get(wid) || { name: wname, incoming: 0, outgoing: 0 };
      cur.outgoing += Number(o.packageQty || 0);
      whMap.set(wid, cur);
    }

    for (const [wid, stats] of whMap.entries()) {
      const inPkg = stats.incoming / pkgSize;
      const bal = Math.max(0, inPkg - stats.outgoing);
      if (bal > 0) {
        otherWarehouses.push({
          warehouseId: wid,
          warehouseName: stats.name,
          balancePkgQty: bal,
        });
      }
    }
  }

  return NextResponse.json({
    item: {
      id: item.id,
      code: item.code,
      paintingCode: item.paintingCode,
      name: item.name,
      unit: item.unit,
      packageUnit: item.packageUnit,
      packageSize: pkgSize,
    },
    incomingBaseQty: totalIncomingBase,
    incomingPkgQty: totalIncomingPkg,
    outgoingPkgQty: totalOutgoingPkg,
    balancePkgQty: balancePkg,
    balanceBaseQty: balancePkg * pkgSize,
    otherWarehouses,
  });
}
