// Cache version — updated at build time by scripts/update-sw-version.cjs
// Using a deterministic version prevents unbounded cache growth from Date.now()
const CACHE_VERSION = '8.8.0';
const CACHE_NAME = `gsd-cache-v${CACHE_VERSION}`;
const OFFLINE_ASSETS = [
	"/",
	"/about/",
	"/archive/",
	"/dashboard/",
	"/install/",
	"/settings/",
	"/sync-history/",
	"/manifest.json",
	"/icons/icon-192.png",
	"/icons/icon-512.png",
	"/icons/icon.svg",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(OFFLINE_ASSETS))
			.then(() => self.skipWaiting()),
	);
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
						return undefined;
					}),
				),
			)
			.then(() => self.clients.claim()),
	);
});

// Handle skip waiting message from update toast
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	// Only handle http/https requests
	if (!request.url.startsWith("http")) {
		return;
	}

	// Don't intercept cross-origin requests (PocketBase API, OAuth, etc.)
	const requestUrl = new URL(request.url);
	if (requestUrl.hostname !== self.location.hostname) {
		return;
	}

	if (request.method !== "GET") {
		return;
	}

	// Network-first for HTML pages and Next.js RSC flight data.
	// RSC data (__next.*.txt) contains build-specific module IDs that
	// must stay in sync with the JS chunks. Serving stale RSC data from
	// a previous build causes React error #130 (undefined component).
	const isNetworkFirst =
		request.headers.get("accept")?.includes("text/html") ||
		request.url.endsWith("/") ||
		request.url.endsWith(".html") ||
		request.url.includes("/__next.");

	if (isNetworkFirst) {
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
				.catch(() => {
					// Try to match the request with or without trailing slash
					return caches.match(request).then((cached) => {
						if (cached) return cached;

						// If request ends with /, try without it, and vice versa
						const url = new URL(request.url);
						const altPath = url.pathname.endsWith("/")
							? url.pathname.slice(0, -1)
							: url.pathname + "/";

						return caches
							.match(altPath)
							.then((altCached) => altCached || caches.match("/"));
					});
				}),
		);
	} else {
		// Cache-first for static assets (JS chunks, CSS, fonts, images)
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				if (cachedResponse) {
					return cachedResponse;
				}

				return fetch(request)
					.then((response) => {
						// Only cache successful responses
						if (
							response &&
							response.status === 200 &&
							response.type === "basic"
						) {
							const clone = response.clone();
							caches.open(CACHE_NAME).then((cache) => {
								cache.put(request, clone).catch(() => {
									// Silently fail if caching fails
								});
							});
						}
						return response;
					})
					.catch(() => {
						// Only fall back to cached root for navigation-like requests.
						// Returning HTML for a JS/CSS/font request would cause errors.
						return caches.match(request);
					});
			}),
		);
	}
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	event.waitUntil(
		clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clientList) => {
				// If app is already open, focus it
				for (const client of clientList) {
					if (
						client.url.includes(self.registration.scope) &&
						"focus" in client
					) {
						return client.focus();
					}
				}
				// Otherwise open a new window
				if (clients.openWindow) {
					return clients.openWindow("/");
				}
			}),
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

	let data;
	try {
		data = event.data.json();
	} catch {
		// Invalid JSON payload — ignore
		return;
	}

	// Validate payload shape
	if (typeof data !== "object" || data === null) {
		return;
	}

	const title =
		typeof data.title === "string" ? data.title : "GSD Task Manager";
	const options = {
		body: typeof data.body === "string" ? data.body : "You have a task reminder",
		icon: "/icons/icon-192.png",
		badge: "/icons/icon-192.png",
		tag: typeof data.tag === "string" ? data.tag : "task-reminder",
		data: typeof data.data === "object" && data.data !== null ? data.data : {},
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
