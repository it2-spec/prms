import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const histories = await prisma.itemPriceHistory.findMany({
      where: { itemId },
      orderBy: { changedAt: "desc" },
    });

    return NextResponse.json(histories);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
