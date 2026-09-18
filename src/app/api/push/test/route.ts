import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/webpush";

export async function POST(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: "Missing subscriptionId" }, { status: 400 });
    }

    const sub = await prisma.pushSubscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { name: true } } },
    });

    if (!sub) {
      return NextResponse.json({ error: "Device subscription not found" }, { status: 404 });
    }

    const success = await sendPushNotification(
      {
        id: sub.id,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
      {
        title: "Test Notifikasi PRMS",
        body: `Halo ${sub.user?.name || "Pengguna"}, notifikasi push di perangkat ${sub.deviceName || "ini"} berfungsi dengan baik!`,
        url: "/purchasing/devices",
      }
    );

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Notifikasi uji coba berhasil dikirim ke perangkat!",
      });
    } else {
      return NextResponse.json(
        { error: "Gagal mengirim notifikasi ke browser. Langganan mungkin sudah kedaluwarsa." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[POST /api/push/test] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
