// Cache version — updated at build time by scripts/update-sw-version.cjs
// Using a deterministic version prevents unbounded cache growth from Date.now()
const CACHE_VERSION = '9.11.2';
const IMMUTABLE_CACHE_VERSION = 1;
const IMMUTABLE_MAX_ENTRIES = 60;

importScripts('./sw-cache-logic.js');

const CACHE_NAMES = getCacheNames(CACHE_VERSION, IMMUTABLE_CACHE_VERSION);

const PRECACHE_PAGES = [
	"/",
	"/about/",
	"/archive/",
	"/dashboard/",
	"/install/",
	"/settings/",
	"/sync-history/",
];

const PRECACHE_RUNTIME = [
	"/manifest.json",
	"/icons/icon-192.png",
	"/icons/icon-512.png",
	"/icons/icon.svg",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		Promise.all([
			caches
				.open(CACHE_NAMES.pages)
				.then((cache) => cache.addAll(PRECACHE_PAGES)),
			caches
				.open(CACHE_NAMES.runtime)
				.then((cache) => cache.addAll(PRECACHE_RUNTIME)),
		]).then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.map((key) => {
						if (shouldDeleteCache(key, CACHE_NAMES)) {
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

	const requestUrl = new URL(request.url);
	const isSameOrigin = requestUrl.origin === self.location.origin;
	const classification = classifyRequest(
		requestUrl.pathname,
		request.headers.get("accept"),
		isSameOrigin,
		request.method,
		request.headers.has("authorization"),
		request.cache,
	);

	if (classification === "passthrough") {
		return;
	}

	if (classification === "pages") {
		// Network-first for HTML pages and Next.js RSC flight data.
		// RSC data (__next.*.txt) contains build-specific module IDs that
		// must stay in sync with the JS chunks. Serving stale RSC data from
		// a previous build causes React error #130 (undefined component).
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response && response.status === 200) {
						const clone = response.clone();
						caches.open(CACHE_NAMES.pages).then((cache) => {
							cache.put(request, clone).catch(() => {});
						});
					}
					return response;
				})
				.catch(() => {
					return caches.match(request).then((cached) => {
						if (cached) return cached;

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
		return;
	}

	// Cache-first for immutable and runtime assets
	const cacheName =
		classification === "immutable"
			? CACHE_NAMES.immutable
			: CACHE_NAMES.runtime;

	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			return fetch(request)
				.then((response) => {
					if (
						response &&
						response.status === 200 &&
						response.type === "basic"
					) {
						const clone = response.clone();
						caches.open(cacheName).then((cache) => {
							cache
								.put(request, clone)
								.then(() => {
									if (classification !== "immutable") return;
									return cache.keys().then((keys) => {
										const toDelete = getEvictionCandidates(
											keys,
											IMMUTABLE_MAX_ENTRIES,
										);
										return Promise.all(
											toDelete.map((key) => cache.delete(key)),
										);
									});
								})
								.catch(() => {});
						});
					}
					return response;
				})
				.catch(() => {
					return caches.match(request);
				});
		}),
	);
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	event.waitUntil(
		clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clientList) => {
				for (const client of clientList) {
					if (
						client.url.includes(self.registration.scope) &&
						"focus" in client
					) {
						return client.focus();
					}
				}
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
		return;
	}

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

async function checkAndNotifyTasks() {
	try {
		if ("setAppBadge" in self.navigator) {
			await self.navigator.setAppBadge(0);
		}
	} catch (error) {
		console.error("Error in background notification check:", error);
	}
}
