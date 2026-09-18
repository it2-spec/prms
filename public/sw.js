// PRMS Service Worker - PWA & Web Push Notifications
const CACHE_NAME = "prms-cache-v2";

const STATIC_ASSETS = [
  "/",
  "/login",
  "/prms.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first with cache fallback for standard GET requests
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip caching API mutations and chrome-extension
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response to cache for static assets or pages
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/");
          }
        });
      })
  );
});

// ==================== WEB PUSH NOTIFICATIONS ====================
self.addEventListener("push", (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    data = {
      title: "PRMS Notification",
      body: event.data ? event.data.text() : "Anda memiliki notifikasi baru di PRMS",
    };
  }

  const title = data.title || "PRMS Notification";
  const options = {
    body: data.body || data.message || "Pemberitahuan baru sistem PRMS",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || data.link || "/",
      id: data.id,
      timestamp: Date.now(),
    },
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if (client.url.includes(targetUrl) || targetUrl === "/") {
            return client.focus();
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
