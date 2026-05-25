// Canonical source for SW cache routing logic.
// public/sw-cache-logic.js is a plain-JS copy of these functions for
// use with importScripts() in the service worker. Keep them in sync.

export type CacheClassification = "immutable" | "pages" | "runtime" | "passthrough";

export interface CacheNameSet {
	immutable: string;
	pages: string;
	runtime: string;
}

export function classifyRequest(
	pathname: string,
	acceptHeader: string | null,
	isSameOrigin: boolean,
	method: string,
): CacheClassification {
	if (method !== "GET" || !isSameOrigin) {
		return "passthrough";
	}

	if (pathname.startsWith("/_next/static/")) {
		return "immutable";
	}

	if (
		(acceptHeader && acceptHeader.includes("text/html")) ||
		pathname.endsWith("/") ||
		pathname.endsWith(".html") ||
		pathname.includes("/__next.")
	) {
		return "pages";
	}

	return "runtime";
}

export function getCacheNames(
	cacheVersion: string,
	immutableVersion: number,
): CacheNameSet {
	return {
		immutable: `gsd-immutable-v${immutableVersion}`,
		pages: `gsd-pages-v${cacheVersion}`,
		runtime: `gsd-runtime-v${cacheVersion}`,
	};
}

export function shouldDeleteCache(
	cacheName: string,
	currentCacheNames: CacheNameSet,
): boolean {
	const currentValues = Object.values(currentCacheNames);
	if (currentValues.includes(cacheName)) {
		return false;
	}
	return cacheName.startsWith("gsd-");
}

export function getEvictionCandidates<T>(keys: T[], maxEntries: number): T[] {
	if (keys.length <= maxEntries) {
		return [];
	}
	return keys.slice(0, keys.length - maxEntries);
}
