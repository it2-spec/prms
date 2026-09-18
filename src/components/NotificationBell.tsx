"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ExternalLink, FileText, ShieldCheck, Clock, XCircle } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  isApprover?: boolean;
}

function formatRelativeTime(dateStr: string, isEnglish: boolean): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSec < 60) return isEnglish ? "Just now" : "Baru saja";
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return isEnglish ? `${diffInMin}m ago` : `${diffInMin} mnt lalu`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return isEnglish ? `${diffInHours}h ago` : `${diffInHours} jam lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return isEnglish ? "Yesterday" : "Kemarin";
  if (diffInDays < 7) return isEnglish ? `${diffInDays}d ago` : `${diffInDays} hari lalu`;

  return new Intl.DateTimeFormat(isEnglish ? "en-US" : "id-ID", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function NotificationBell({ isApprover = false }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const knownNotifIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef(true);

  const showDesktopAlert = (notif: NotificationItem) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(notif.title, {
            body: notif.message,
            icon: "/prms.png",
            badge: "/prms.png",
            data: { url: notif.link || "/" },
          });
        }).catch(() => {
          new Notification(notif.title, {
            body: notif.message,
            icon: "/prms.png",
          });
        });
      } else {
        new Notification(notif.title, {
          body: notif.message,
          icon: "/prms.png",
        });
      }
    } catch {
      // ignore
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const incomingNotifs: NotificationItem[] = data.notifications || [];
        setUnreadCount(data.unreadCount || 0);
        setNotifications(incomingNotifs);

        if (isFirstFetchRef.current) {
          isFirstFetchRef.current = false;
          incomingNotifs.forEach((n) => knownNotifIdsRef.current.add(n.id));
        } else {
          // Check for newly arrived unread notifications
          incomingNotifs.forEach((n) => {
            if (!knownNotifIdsRef.current.has(n.id)) {
              knownNotifIdsRef.current.add(n.id);
              if (!n.isRead) {
                showDesktopAlert(n);
              }
            }
          });
        }
      }
    } catch {
      // silently ignore network jitter
    }
  }, []);

  // Initial fetch and periodic polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);

    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      // Optimistic update
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notif.id }),
      }).catch(() => {});
    }

    setOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        title={isApprover ? "Notifications" : "Notifikasi"}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">
                {isApprover ? "Notifications" : "Notifikasi"}
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  {unreadCount} {isApprover ? "new" : "baru"}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{isApprover ? "Mark all read" : "Tandai dibaca"}</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-medium">
                  {isApprover ? "No notifications yet" : "Belum ada notifikasi"}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isApprovedL1 = notif.type === "PO_APPROVED_L1";
                const isNewPo = notif.type === "NEW_PO";

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 text-left ${
                      notif.isRead
                        ? "hover:bg-slate-50 bg-white"
                        : "bg-blue-50/40 hover:bg-blue-50/70"
                    }`}
                  >
                    {/* Icon based on notification type */}
                    <div className="mt-0.5 shrink-0">
                      {notif.type === "PO_CANCELLED" ? (
                        <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                          <XCircle className="w-4 h-4" />
                        </div>
                      ) : isApprovedL1 ? (
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                      ) : isNewPo ? (
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                          <Bell className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs truncate ${
                            notif.isRead
                              ? "font-semibold text-slate-800"
                              : "font-bold text-slate-900"
                          }`}
                        >
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1.5 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(notif.createdAt, isApprover)}</span>
                        {notif.link && (
                          <>
                            <span>·</span>
                            <span className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold">
                              {isApprover ? "Review" : "Lihat"}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
