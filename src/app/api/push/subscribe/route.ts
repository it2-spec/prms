import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { endpoint, keys, userAgent, deviceName } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 }
      );
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
        deviceName: deviceName || null,
      },
      update: {
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
        deviceName: deviceName || null,
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      message: "Push subscription registered successfully",
    });
  } catch (error: any) {
    console.error("[POST /api/push/subscribe] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
