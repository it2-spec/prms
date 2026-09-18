import webPush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@prms.local";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error("[webpush] Error setting VAPID details:", err);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: any;
}

/**
 * Kirim Web Push Notification ke satu langganan spesifik
 */
export async function sendPushNotification(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[webpush] VAPID keys not configured, skipping push.");
    return false;
  }

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  try {
    await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (error: any) {
    // Error 404 / 410 artinya langganan sudah kedaluwarsa atau dicabut di browser
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.log(`[webpush] Subscription expired (${error.statusCode}), removing: ${sub.id}`);
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    } else {
      console.error(`[webpush] Failed to send push to ${sub.endpoint.slice(0, 35)}...:`, error.message);
    }
    return false;
  }
}

/**
 * Kirim Web Push Notification ke semua perangkat terdaftar milik user tertentu
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    if (subs.length === 0) return 0;

    let successCount = 0;
    await Promise.all(
      subs.map(async (sub) => {
        const ok = await sendPushNotification(sub, payload);
        if (ok) successCount++;
      })
    );

    return successCount;
  } catch (err) {
    console.error(`[webpush] Error dispatching to user ${userId}:`, err);
    return 0;
  }
}

/**
 * Kirim Web Push Notification ke banyak user sekaligus
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return 0;
  let totalSent = 0;
  await Promise.all(
    userIds.map(async (uid) => {
      const sent = await sendPushToUser(uid, payload);
      totalSent += sent;
    })
  );
  return totalSent;
}
