import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const items = await prisma.item.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { priceHistories: true } },
      },
    });
    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { code, name, unit, packageUnit, packageSize, lastUnitPrice, description } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Kode & Nama Item wajib diisi" }, { status: 400 });
    }

    const existing = await prisma.item.findUnique({ where: { code: code.trim() } });
    if (existing) {
      return NextResponse.json({ error: `Kode item '${code}' sudah digunakan` }, { status: 400 });
    }

    const item = await prisma.item.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        unit: unit?.trim() || "kg",
        packageUnit: packageUnit?.trim() || null,
        packageSize: packageSize ? Number(packageSize) : null,
        lastUnitPrice: lastUnitPrice ? Number(lastUnitPrice) : null,
        description: description?.trim() || null,
        isActive: true,
      },
    });

    if (item.lastUnitPrice != null) {
      await prisma.itemPriceHistory.create({
        data: {
          itemId: item.id,
          oldUnitPrice: null,
          newUnitPrice: Number(item.lastUnitPrice),
          source: `Input Manual Awal (${user.name})`,
        },
      });
    }

    await writeAuditLog(user, "CREATE_ITEM", "Item", item.id, `Tambah Item ${item.code} - ${item.name}`);

    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { id, code, name, unit, packageUnit, packageSize, lastUnitPrice, description, isActive } = body;

    if (!id || !code || !name) {
      return NextResponse.json({ error: "Data item tidak lengkap" }, { status: 400 });
    }

    const currentItem = await prisma.item.findUnique({ where: { id } });
    if (!currentItem) {
      return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
    }

    const oldPrice = currentItem.lastUnitPrice ? Number(currentItem.lastUnitPrice) : null;
    const newPrice = lastUnitPrice !== undefined && lastUnitPrice !== "" && lastUnitPrice !== null
      ? Number(lastUnitPrice)
      : null;

    const updated = await prisma.item.update({
      where: { id },
      data: {
        code: code.trim(),
        name: name.trim(),
        unit: unit?.trim() || "kg",
        packageUnit: packageUnit?.trim() || null,
        packageSize: packageSize ? Number(packageSize) : null,
        lastUnitPrice: lastUnitPrice !== undefined ? newPrice : undefined,
        description: description?.trim() || null,
        isActive: Boolean(isActive),
      },
    });

    // Record price change history if price is updated manually
    if (newPrice != null && (oldPrice === null || Math.abs(oldPrice - newPrice) > 0.01)) {
      await prisma.itemPriceHistory.create({
        data: {
          itemId: id,
          oldUnitPrice: oldPrice,
          newUnitPrice: newPrice,
          source: `Update Manual (${user.name})`,
        },
      });
    }

    await writeAuditLog(user, "UPDATE_ITEM", "Item", updated.id, `Update Item ${updated.code}`);

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID item wajib disertakan" }, { status: 400 });

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        poDetails: {
          include: {
            purchaseOrder: {
              select: {
                id: true,
                poNumber: true,
                status: true,
                poDate: true,
                supplier: { select: { name: true } },
              },
            },
          },
        },
        deliveryDetails: {
          include: {
            delivery: {
              select: {
                id: true,
                deliveryNumber: true,
                suratJalan: true,
                shipDate: true,
              },
            },
          },
        },
        receivingDetails: {
          include: {
            receiving: {
              select: {
                id: true,
                receivingNumber: true,
                receivedAt: true,
              },
            },
          },
        },
        prerequestDetails: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
    }

    const linkedPos = item.poDetails.map((pd) => ({
      id: pd.purchaseOrder.id,
      poNumber: pd.purchaseOrder.poNumber,
      status: pd.purchaseOrder.status,
      poDate: pd.purchaseOrder.poDate,
      supplierName: pd.purchaseOrder.supplier.name,
      qty: pd.qty,
    }));

    const linkedDeliveries = item.deliveryDetails.map((dd) => ({
      id: dd.delivery.id,
      deliveryNumber: dd.delivery.deliveryNumber,
      suratJalan: dd.delivery.suratJalan,
      shipDate: dd.delivery.shipDate,
      qty: dd.qty,
    }));

    const linkedReceivings = item.receivingDetails.map((rd) => ({
      id: rd.receiving.id,
      receivingNumber: rd.receiving.receivingNumber,
      receivedAt: rd.receiving.receivedAt,
      qty: rd.qtyReceived,
    }));

    const hasRealTransactions =
      linkedPos.length > 0 || linkedDeliveries.length > 0 || linkedReceivings.length > 0;

    if (hasRealTransactions) {
      return NextResponse.json(
        {
          error: `Item "${item.code} — ${item.name}" tidak dapat dihapus karena masih tercatat dalam riwayat transaksi aktif.`,
          transactions: {
            purchaseOrders: linkedPos,
            deliveries: linkedDeliveries,
            receivings: linkedReceivings,
          },
        },
        { status: 400 }
      );
    }

    // Jika hanya ada sisa dummy prerequestDetails (tanpa transaksi PO riil), bersihkan relasi tersebut
    if (item.prerequestDetails.length > 0) {
      await prisma.purchaseRequestDetail.deleteMany({ where: { itemId: id } });
    }

    const deleted = await prisma.item.delete({ where: { id } });
    await writeAuditLog(user, "DELETE_ITEM", "Item", id, `Hapus Item ${deleted.code} - ${deleted.name}`);

    return NextResponse.json({ success: true, message: `Item ${deleted.code} berhasil dihapus` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal menghapus item" }, { status: 500 });
  }
}
