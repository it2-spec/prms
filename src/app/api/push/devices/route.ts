import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await prisma.pushSubscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            approvalLevel: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error("[GET /api/push/devices] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing device subscription ID" }, { status: 400 });
    }

    await prisma.pushSubscription.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Device unregistered successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/push/devices] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
