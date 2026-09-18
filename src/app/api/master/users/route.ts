import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { hash } from "bcryptjs";

// GET /api/master/users - list all users (PURCHASING only)
export async function GET() {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      include: {
        role: { select: { name: true } },
        supplier: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role.name,
        roleId: u.roleId,
        supplierId: u.supplierId,
        supplierName: u.supplier?.name ?? null,
        warehouseId: u.warehouseId,
        warehouseName: u.warehouse?.name ?? null,
        isActive: u.isActive,
        approvalLevel: u.approvalLevel,
        signatureImage: u.signatureImage,
        createdAt: u.createdAt,
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/master/users - create user
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { username, name, email, password, roleName, supplierId, warehouseId } = body;

    if (!username || !name || !password || !roleName) {
      return NextResponse.json(
        { error: "Username, Nama, Password, dan Role wajib diisi" },
        { status: 400 }
      );
    }

    // Check username uniqueness
    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing) {
      return NextResponse.json({ error: `Username '${username}' sudah digunakan` }, { status: 400 });
    }

    // Resolve roleId from RoleName
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      return NextResponse.json({ error: `Role '${roleName}' tidak ditemukan` }, { status: 400 });
    }

    const hashed = await hash(password, 10);

    const created = await prisma.user.create({
      data: {
        username: username.trim(),
        name: name.trim(),
        email: email?.trim() || null,
        password: hashed,
        roleId: role.id,
        supplierId: roleName === "SUPPLIER" ? (supplierId || null) : null,
        warehouseId: roleName === "WAREHOUSE" ? (warehouseId || null) : null,
        isActive: true,
      },
    });

    await writeAuditLog(
      user,
      "CREATE_USER",
      "User",
      created.id,
      `Tambah User ${created.username} (${roleName})`
    );

    return NextResponse.json({ success: true, id: created.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/master/users - update user
export async function PUT(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, username, name, email, password, roleName, supplierId, warehouseId, isActive, approvalLevel, signatureImage } = body;

    if (!id || !username || !name || !roleName) {
      return NextResponse.json({ error: "Data user tidak lengkap" }, { status: 400 });
    }

    // Check username uniqueness excluding self
    const existing = await prisma.user.findFirst({
      where: { username: username.trim(), NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: `Username '${username}' sudah digunakan` }, { status: 400 });
    }

    // Prevent editing self role/active state? Allow for flexibility.
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      return NextResponse.json({ error: `Role '${roleName}' tidak ditemukan` }, { status: 400 });
    }

    const updateData: any = {
      username: username.trim(),
      name: name.trim(),
      email: email?.trim() || null,
      roleId: role.id,
      supplierId: roleName === "SUPPLIER" ? (supplierId || null) : null,
      warehouseId: roleName === "WAREHOUSE" ? (warehouseId || null) : null,
      isActive: Boolean(isActive),
      ...(approvalLevel !== undefined ? { approvalLevel: Number(approvalLevel) } : {}),
      ...(signatureImage !== undefined ? { signatureImage: signatureImage || null } : {}),
    };

    if (password && password.trim() !== "") {
      updateData.password = await hash(password.trim(), 10);
    }

    const updated = await prisma.user.update({ where: { id }, data: updateData });

    await writeAuditLog(
      user,
      "UPDATE_USER",
      "User",
      updated.id,
      `Update User ${updated.username} (${roleName})`
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/master/users?id=...
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Prevent self-delete
    if (id === user.id) {
      return NextResponse.json({ error: "Tidak dapat menghapus akun sendiri" }, { status: 400 });
    }

    const deleted = await prisma.user.delete({ where: { id } });
    await writeAuditLog(
      user,
      "DELETE_USER",
      "User",
      id,
      `Hapus User ${deleted.username}`
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal menghapus user" }, { status: 500 });
  }
}
