"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

function roleHome(role: string) {
  return role === "PURCHASING" ? "/purchasing" : role === "WAREHOUSE" ? "/warehouse" : "/supplier";
}

export async function loginAction(formData: FormData) {
  try {
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return { error: "Username atau password salah." };
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return { error: "Username atau password salah." };
    }

    await createSession({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role.name,
      approvalLevel: user.approvalLevel,
      supplierId: user.supplierId,
      warehouseId: user.warehouseId,
    });

    await writeAuditLog(
      { id: user.id, username: user.username, name: user.name, role: user.role.name },
      "LOGIN",
      "User",
      user.id,
    );

    return { success: true, redirectUrl: roleHome(user.role.name) };
  } catch (e) {
    console.error("[LOGIN]", e);
    return { error: "Terjadi kesalahan pada server." };
  }
}
