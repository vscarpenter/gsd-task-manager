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
