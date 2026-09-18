import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

export async function GET() {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const warehouses = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json(warehouses);
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
    const { code, name, address } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Kode & Nama Warehouse wajib diisi" }, { status: 400 });
    }

    const existing = await prisma.warehouse.findUnique({ where: { code: code.trim() } });
    if (existing) {
      return NextResponse.json({ error: `Kode warehouse '${code}' sudah digunakan` }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        address: address?.trim() || null,
        isActive: true,
      },
    });

    await writeAuditLog(user, "CREATE_WAREHOUSE", "Warehouse", warehouse.id, `Tambah Warehouse ${warehouse.code} - ${warehouse.name}`);

    return NextResponse.json(warehouse);
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
    const { id, code, name, address, isActive } = body;

    if (!id || !code || !name) {
      return NextResponse.json({ error: "Data warehouse tidak lengkap" }, { status: 400 });
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        code: code.trim(),
        name: name.trim(),
        address: address?.trim() || null,
        isActive: Boolean(isActive),
      },
    });

    await writeAuditLog(user, "UPDATE_WAREHOUSE", "Warehouse", updated.id, `Update Warehouse ${updated.code}`);

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
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse tidak ditemukan" }, { status: 404 });
    }

    // Cek relasi data sebelum menghapus
    const [purchaseOrders, receivings, users] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { warehouseId: id },
        select: {
          id: true,
          poNumber: true,
          status: true,
          createdAt: true,
          supplier: { select: { name: true } },
        },
        take: 20,
      }),
      prisma.receiving.findMany({
        where: { warehouseId: id },
        select: {
          id: true,
          receivingNumber: true,
          receivedAt: true,
          status: true,
          delivery: {
            select: {
              id: true,
              deliveryNumber: true,
              suratJalan: true,
              supplier: { select: { name: true } },
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
            },
          },
        },
        take: 20,
      }),
      prisma.user.findMany({
        where: { warehouseId: id },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
        },
        take: 20,
      }),
    ]);

    const totalRelations = purchaseOrders.length + receivings.length + users.length;
    if (totalRelations > 0) {
      const relations: string[] = [];
      if (purchaseOrders.length > 0) relations.push(`${purchaseOrders.length} Purchase Order`);
      if (receivings.length > 0) relations.push(`${receivings.length} Penerimaan (Receiving)`);
      if (users.length > 0) relations.push(`${users.length} Akun Pengguna`);

      return NextResponse.json(
        {
          error: `Warehouse '${warehouse.name}' tidak dapat dihapus karena masih terhubung dengan ${relations.join(", ")}. Anda dapat menonaktifkan statusnya agar tidak digunakan lagi.`,
          transactions: {
            purchaseOrders,
            receivings,
            users,
          },
        },
        { status: 400 },
      );
    }

    const deleted = await prisma.warehouse.delete({ where: { id } });
    await writeAuditLog(user, "DELETE_WAREHOUSE", "Warehouse", id, `Hapus Warehouse ${deleted.code}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal menghapus warehouse" }, { status: 500 });
  }
}
