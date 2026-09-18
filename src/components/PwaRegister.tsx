"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker globally
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PRMS PWA ServiceWorker active on scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("PRMS PWA ServiceWorker registration failed:", err);
          });
      });
    }

    // 2. Listen for PWA Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user has dismissed banner in this session
      const dismissed = sessionStorage.getItem("pwa_prompt_dismissed");
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShowBanner(false);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  }

  if (!showBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/icon-192.png"
            alt="PRMS"
            className="w-10 h-10 rounded-xl bg-white p-1 shrink-0"
          />
          <div>
            <h4 className="font-bold text-sm text-white">Pasang Aplikasi PRMS</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Akses cepat langsung dari layar utama HP / Desktop Anda.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
        >
          Nanti Saja
        </button>
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Pasang (Install)</span>
        </button>
      </div>
    </div>
  );
}
