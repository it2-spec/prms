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

  const item = await prisma.item.findUnique({
    where: { code: itemCode },
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      packageUnit: true,
      packageSize: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: `Item dengan kode "${itemCode}" tidak ditemukan` }, { status: 404 });
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

  return NextResponse.json({
    item: {
      id: item.id,
      code: item.code,
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
  });
}
