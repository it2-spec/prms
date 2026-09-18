"use client";

import React, { useEffect, useState } from "react";
import { Bell, ShieldCheck, X, Sparkles } from "lucide-react";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BGcKvBELji8JfWp6nG4wcb4kC5cXptUwmkKB2V94pRrGgunV0RiZ8WZVnb3PcvZOfHyRFn-7uHv0DbelNdvXgQo";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceInfo(): { deviceName: string; userAgent: string } {
  if (typeof navigator === "undefined") {
    return { deviceName: "Unknown Device", userAgent: "" };
  }
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Perangkat";
  if (ua.includes("Windows NT 10.0") || ua.includes("Windows NT 11.0")) os = "Windows 10/11";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh")) os = "MacOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return {
    deviceName: `${os} (${browser})`,
    userAgent: ua,
  };
}

export default function PushNotificationManager() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      return;
    }

    setIsSupported(true);

    // Register Service Worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (Notification.permission === "granted") {
          // Jika sudah diizinkan, pastikan langganan terdaftar di latar belakang
          silentlySyncSubscription(reg);
        } else if (Notification.permission === "default") {
          // Hanya tampilkan jika belum pernah diizinkan dan belum ditutup di sesi ini
          const dismissed = sessionStorage.getItem("prms_push_prompt_dismissed");
          if (!dismissed) {
            const timer = setTimeout(() => setShowPrompt(true), 1200);
            return () => clearTimeout(timer);
          }
        }
      })
      .catch((err) => {
        console.warn("[PushManager] Service Worker registration failed:", err);
      });
  }, []);

  const silentlySyncSubscription = async (reg: ServiceWorkerRegistration) => {
    try {
      const info = getDeviceInfo();
      let sub: PushSubscription | null = null;

      if ("pushManager" in reg) {
        try {
          sub = await reg.pushManager.getSubscription();
          if (!sub && VAPID_PUBLIC_KEY) {
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });
          }
        } catch {
          // Push service mungkin tidak terjangkau (FCM/firewall)
        }
      }

      const endpoint = sub ? sub.endpoint : `local-${info.deviceName.replace(/\s+/g, "-")}`;
      const json = sub ? sub.toJSON() : null;

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          keys: json?.keys || { p256dh: "local", auth: "local" },
          deviceName: info.deviceName,
          userAgent: info.userAgent,
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  const handleEnablePush = async () => {
    if (!("Notification" in window)) return;

    // Tutup dialog banner segera agar tidak menggantung di layar
    setShowPrompt(false);
    sessionStorage.setItem("prms_push_prompt_dismissed", "true");

    try {
      setLoading(true);
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        const info = getDeviceInfo();
        let sub: PushSubscription | null = null;

        if ("pushManager" in reg) {
          try {
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });
          } catch (pushErr: any) {
            console.warn("[PushManager] Push service subscription skipped:", pushErr.message);
          }
        }

        const endpoint = sub ? sub.endpoint : `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const json = sub ? sub.toJSON() : null;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint,
            keys: json?.keys || { p256dh: "local", auth: "local" },
            deviceName: info.deviceName,
            userAgent: info.userAgent,
          }),
        }).catch(() => {});

        // Tampilkan notifikasi konfirmasi langsung di desktop
        try {
          reg.showNotification("Notifikasi PRMS Aktif", {
            body: "Notifikasi desktop berhasil diaktifkan! Anda akan menerima update PO secara real-time.",
            icon: "/prms.png",
            badge: "/prms.png",
          });
        } catch {
          new Notification("Notifikasi PRMS Aktif", {
            body: "Notifikasi desktop berhasil diaktifkan! Anda akan menerima update PO secara real-time.",
            icon: "/prms.png",
          });
        }
      }
    } catch (err) {
      console.error("[PushManager] Permission handling error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("prms_push_prompt_dismissed", "true");
    setShowPrompt(false);
  };

  if (!isSupported || !showPrompt) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-none">
      <div className="pointer-events-auto bg-white rounded-3xl p-5 shadow-2xl border border-blue-100 ring-4 ring-blue-500/10 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                Aktifkan Notifikasi Perangkat
                <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Dapatkan pemberitahuan instan saat ada PO baru, approval Manager &amp; Presdir, serta update kiriman di layar Anda.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleEnablePush}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{loading ? "Memproses..." : "Aktifkan Sekarang"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
