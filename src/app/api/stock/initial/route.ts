import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/stock/initial?warehouseId=...
export async function GET(req: NextRequest) {
  try {
    const { user, dbUser } = await getSessionUser();
    const allowedRoles = ["PURCHASING", "WAREHOUSE", "ADMIN_PRODUKSI"];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let warehouseId = searchParams.get("warehouseId");

    if (user.role === "WAREHOUSE" && dbUser?.warehouseId) {
      warehouseId = dbUser.warehouseId;
    }

    if (!warehouseId || warehouseId === "all") {
      const firstWh = await prisma.warehouse.findFirst({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
      warehouseId = firstWh?.id || "";
    }

    const [items, initialStocks, warehouse] = await Promise.all([
      prisma.item.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          packageUnit: true,
          packageSize: true,
          departmentScope: true,
          departments: true,
        },
      }),
      warehouseId
        ? prisma.itemInitialStock.findMany({
            where: { warehouseId },
            include: {
              createdBy: { select: { id: true, name: true } },
            },
          })
        : [],
      warehouseId
        ? prisma.warehouse.findUnique({
            where: { id: warehouseId },
            select: { id: true, name: true, code: true },
          })
        : null,
    ]);

    const stockMap = new Map(initialStocks.map((s) => [s.itemId, s]));

    const list = items.map((item) => {
      const record = stockMap.get(item.id);
      return {
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        unit: item.unit || "kg",
        packageUnit: item.packageUnit || "Pail",
        packageSize: Number(item.packageSize ?? 1),
        departmentScope: item.departmentScope,
        departments: item.departments,
        initialStockId: record?.id || null,
        packageQty: record ? Number(record.packageQty) : 0,
        baseQty: record ? Number(record.baseQty) : 0,
        cutoffDate: record?.cutoffDate || null,
        notes: record?.notes || "",
        updatedAt: record?.updatedAt || null,
        createdByName: record?.createdBy?.name || null,
      };
    });

    return NextResponse.json({
      success: true,
      warehouse,
      items: list,
    });
  } catch (err: any) {
    console.error("GET /api/stock/initial error:", err);
    return NextResponse.json({ error: err.message || "Failed to load initial stock" }, { status: 500 });
  }
}

// POST /api/stock/initial
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || (user.role !== "PURCHASING" && user.role !== "WAREHOUSE")) {
      return NextResponse.json(
        { error: "Hanya Purchasing atau Warehouse yang dapat mengatur saldo awal" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { warehouseId, cutoffDate, stocks } = body;

    if (!warehouseId) {
      return NextResponse.json({ error: "Gudang wajib dipilih" }, { status: 400 });
    }

    if (!Array.isArray(stocks) || stocks.length === 0) {
      return NextResponse.json({ error: "Data stok awal tidak boleh kosong" }, { status: 400 });
    }

    const cutoff = cutoffDate ? new Date(cutoffDate) : new Date();

    const results = await prisma.$transaction(async (tx) => {
      const updatedList = [];

      for (const itemStock of stocks) {
        const { itemId, packageQty, baseQty, notes } = itemStock;
        if (!itemId) continue;

        const pkgQtyNum = Math.max(0, Number(packageQty) || 0);

        let finalBaseQty = Number(baseQty);
        if (isNaN(finalBaseQty) || finalBaseQty === undefined) {
          const it = await tx.item.findUnique({
            where: { id: itemId },
            select: { packageSize: true },
          });
          const pkgSize = Number(it?.packageSize ?? 1);
          finalBaseQty = pkgQtyNum * pkgSize;
        }

        const upserted = await tx.itemInitialStock.upsert({
          where: {
            itemId_warehouseId: {
              itemId,
              warehouseId,
            },
          },
          update: {
            packageQty: pkgQtyNum,
            baseQty: finalBaseQty,
            cutoffDate: cutoff,
            notes: notes?.trim() || null,
            createdById: user.id,
          },
          create: {
            itemId,
            warehouseId,
            packageQty: pkgQtyNum,
            baseQty: finalBaseQty,
            cutoffDate: cutoff,
            notes: notes?.trim() || null,
            createdById: user.id,
          },
        });

        updatedList.push(upserted);
      }

      return updatedList;
    });

    const wh = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { name: true, code: true },
    });

    await writeAuditLog(
      user,
      "SET_INITIAL_STOCK",
      "ItemInitialStock",
      warehouseId,
      `Atur saldo awal untuk ${results.length} item di gudang ${wh?.name || warehouseId}`
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil menyimpan saldo awal untuk ${results.length} item`,
      updatedCount: results.length,
    });
  } catch (err: any) {
    console.error("POST /api/stock/initial error:", err);
    return NextResponse.json({ error: err.message || "Gagal menyimpan saldo awal" }, { status: 500 });
  }
}
