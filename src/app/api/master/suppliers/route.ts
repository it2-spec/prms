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
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(suppliers);
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
    const { code, name, address, phone, email, contactPerson } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Kode & Nama Supplier wajib diisi" }, { status: 400 });
    }

    const existing = await prisma.supplier.findUnique({ where: { code: code.trim() } });
    if (existing) {
      return NextResponse.json({ error: `Kode supplier '${code}' sudah digunakan` }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        isActive: true,
      },
    });

    await writeAuditLog(user, "CREATE_SUPPLIER", "Supplier", supplier.id, `Tambah Supplier ${supplier.code} - ${supplier.name}`);

    return NextResponse.json(supplier);
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
    const { id, code, name, address, phone, email, contactPerson, isActive } = body;

    if (!id || !code || !name) {
      return NextResponse.json({ error: "Data supplier tidak lengkap" }, { status: 400 });
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        code: code.trim(),
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        isActive: Boolean(isActive),
      },
    });

    await writeAuditLog(user, "UPDATE_SUPPLIER", "Supplier", updated.id, `Update Supplier ${updated.code}`);

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
    if (!id) return NextResponse.json({ error: "ID supplier wajib disertakan" }, { status: 400 });

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            poDate: true,
          },
          orderBy: { createdAt: "desc" },
        },
        deliveries: {
          select: {
            id: true,
            deliveryNumber: true,
            suratJalan: true,
            shipDate: true,
          },
          orderBy: { shipDate: "desc" },
        },
        users: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        purchasesrequests: {
          select: {
            id: true,
            prNumber: true,
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
    }

    const hasActiveTransactions =
      supplier.purchaseOrders.length > 0 ||
      supplier.deliveries.length > 0 ||
      supplier.users.length > 0;

    if (hasActiveTransactions) {
      const relations: string[] = [];
      if (supplier.purchaseOrders.length > 0) relations.push(`${supplier.purchaseOrders.length} Purchase Order`);
      if (supplier.deliveries.length > 0) relations.push(`${supplier.deliveries.length} Pengiriman / Surat Jalan`);
      if (supplier.users.length > 0) relations.push(`${supplier.users.length} Akun Pengguna`);

      return NextResponse.json(
        {
          error: `Supplier "${supplier.name}" tidak dapat dihapus karena masih terhubung dengan ${relations.join(", ")}. Anda dapat menonaktifkan statusnya agar tidak digunakan lagi.`,
          transactions: {
            purchaseOrders: supplier.purchaseOrders,
            deliveries: supplier.deliveries,
            users: supplier.users,
          },
        },
        { status: 400 },
      );
    }

    // Jika tidak ada PO/Delivery/User, bersihkan relasi dummy PurchaseRequest (bawaan seed) agar tidak melanggar foreign key
    if (supplier.purchasesrequests.length > 0) {
      const prIds = supplier.purchasesrequests.map((p) => p.id);
      await prisma.purchaseRequestDetail.deleteMany({
        where: { purchaseRequestId: { in: prIds } },
      });
      await prisma.purchaseRequest.deleteMany({
        where: { id: { in: prIds } },
      });
    }

    const deleted = await prisma.supplier.delete({ where: { id } });
    await writeAuditLog(user, "DELETE_SUPPLIER", "Supplier", id, `Hapus Supplier ${deleted.code} - ${deleted.name}`);

    return NextResponse.json({ success: true, message: `Supplier ${deleted.name} berhasil dihapus` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal menghapus supplier" }, { status: 500 });
  }
}
