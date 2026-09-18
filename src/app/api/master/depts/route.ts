import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const { user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let depts: any[] = [];
    if ((prisma as any).dept?.findMany) {
      depts = await (prisma as any).dept.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
    } else {
      depts = await prisma.$queryRaw<any[]>`
        SELECT id, code, name, "isActive", "createdAt" FROM "Dept" WHERE "isActive" = true ORDER BY name ASC
      `;
    }
    return NextResponse.json(depts);
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return NextResponse.json({ error: "Gagal mengambil data departemen" }, { status: 500 });
  }
}
