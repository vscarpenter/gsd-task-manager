// Service worker cache routing logic — pure functions for testability.
// Loaded via importScripts() in sw.js (functions land on global scope).
// Imported in tests via: require("../../public/sw-cache-logic")

function classifyRequest(
	pathname,
	acceptHeader,
	isSameOrigin,
	method,
	hasAuthorizationHeader,
	cacheMode,
) {
	if (method !== "GET" || !isSameOrigin) {
		return "passthrough";
	}

	if (
		hasAuthorizationHeader ||
		cacheMode === "no-store" ||
		pathname === "/api" ||
		pathname.startsWith("/api/") ||
		pathname === "/_" ||
		pathname.startsWith("/_/")
	) {
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

	if (isRuntimeAsset(pathname)) {
		return "runtime";
	}

	return "passthrough";
}

function isRuntimeAsset(pathname) {
	return (
		pathname === "/manifest.json" ||
		pathname === "/favicon.svg" ||
		pathname.startsWith("/icons/")
	);
}

function getCacheNames(cacheVersion, immutableVersion) {
	return {
		immutable: `gsd-immutable-v${immutableVersion}`,
		pages: `gsd-pages-v${cacheVersion}`,
		runtime: `gsd-runtime-v${cacheVersion}`,
	};
}

function shouldDeleteCache(cacheName, currentCacheNames) {
	const currentValues = Object.values(currentCacheNames);
	if (currentValues.includes(cacheName)) {
		return false;
	}
	return cacheName.startsWith("gsd-");
}

function getEvictionCandidates(keys, maxEntries) {
	if (keys.length <= maxEntries) {
		return [];
	}
	return keys.slice(0, keys.length - maxEntries);
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		classifyRequest,
		getCacheNames,
		shouldDeleteCache,
		getEvictionCandidates,
	};
}
