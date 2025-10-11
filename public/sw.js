// Use timestamp for cache versioning to ensure iOS devices get updates
const CACHE_NAME = `gsd-cache-${Date.now()}`;
const OFFLINE_ASSETS = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle http/https requests
  if (!request.url.startsWith('http')) {
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  // Network-first strategy for HTML to ensure fresh content on iOS
  const isHTMLRequest = request.headers.get('accept')?.includes('text/html') ||
                        request.url.endsWith('/') ||
                        request.url.endsWith('.html');

  if (isHTMLRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML response
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("/")))
    );
  } else {
    // Cache-first for static assets
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Only cache successful responses
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone).catch(() => {
                  // Silently fail if caching fails
                });
              });
            }
            return response;
          })
          .catch(() => caches.match("/"));
      })
    );
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// Handle periodic background sync for notifications
// Supported on Chrome/Edge (desktop/mobile), not yet on Safari/iOS
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-notifications") {
    event.waitUntil(checkAndNotifyTasks());
  }
});

// Handle push notifications (for future enhancement)
self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  const title = data.title || "GSD Task Manager";
  const options = {
    body: data.body || "You have a task reminder",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "task-reminder",
    data: data.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Check tasks and send notifications (background sync version)
 * This is a simplified version that works in service worker context
 */
async function checkAndNotifyTasks() {
  try {
    // Open IndexedDB and check for due tasks
    // Note: This would require importing Dexie or using native IndexedDB API
    // For now, we'll rely on the active polling when app is open
    // This is a placeholder for future enhancement if needed

    // Update badge count
    if ("setAppBadge" in self.navigator) {
      // In a real implementation, query IndexedDB for task count
      // For now, this is a placeholder
      await self.navigator.setAppBadge(0);
    }
  } catch (error) {
    console.error("Error in background notification check:", error);
  }
}
