import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const whereClause: any = { userId: user.id };

    // Strict notification policy for Executives:
    // L1 Manager ONLY receives notifications for POs awaiting L1 signature
    if (user.approvalLevel === 1) {
      whereClause.type = "NEW_PO";
    }
    // L2 Presdir ONLY receives notifications for POs awaiting L2 signature
    else if (user.approvalLevel === 2) {
      whereClause.type = "PO_APPROVED_L1";
    }

    const [unreadCount, notifications] = await Promise.all([
      prisma.notification.count({
        where: {
          ...whereClause,
          isRead: false,
        },
      }),
      prisma.notification.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("[GET /api/notifications] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, markAllRead } = body;

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
      return NextResponse.json({ success: true, message: "All marked as read" });
    }

    if (id) {
      await prisma.notification.updateMany({
        where: {
          id,
          userId: user.id,
        },
        data: {
          isRead: true,
        },
      });
      return NextResponse.json({ success: true, message: "Marked as read" });
    }

    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  } catch (error) {
    console.error("[PATCH /api/notifications] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
