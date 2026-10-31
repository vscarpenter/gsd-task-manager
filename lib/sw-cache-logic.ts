// Canonical source for SW cache routing logic.
// scripts/generate-sw-cache-logic.cjs generates public/sw-cache-logic.js from
// this file for importScripts() in the service worker. Edit only this file.

export type CacheClassification = "immutable" | "pages" | "runtime" | "passthrough";

export interface CacheNameSet {
	immutable: string;
	pages: string;
	runtime: string;
}

const LEGACY_CAPTURE_QUERY_KEYS = ["action", "title", "url", "tags"] as const;

export function classifyRequest(
	pathname: string,
	acceptHeader: string | null,
	isSameOrigin: boolean,
	method: string,
	hasAuthorizationHeader = false,
	cacheMode: string | null = null,
): CacheClassification {
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

function isRuntimeAsset(pathname: string): boolean {
	return (
		pathname === "/manifest.json" ||
		pathname === "/theme-init.js" ||
		pathname === "/favicon.svg" ||
		pathname.startsWith("/icons/")
	);
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

/**
 * Return a network/cache-safe replacement for the retired query-string
 * bookmarklet contract. Null means the URL is not a valid legacy capture URL.
 */
export function getSafeLegacyCaptureUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.searchParams.get("action") !== "capture") {
			return null;
		}
		return getSafePageUrl(value);
	} catch {
		return null;
	}
}

export function isCapturePayloadUrl(value: string): boolean {
	try {
		const url = new URL(value);
		const fragmentParams = new URLSearchParams(url.hash.slice(1));
		return (
			url.searchParams.get("action") === "capture" ||
			fragmentParams.get("action") === "capture"
		);
	} catch {
		return false;
	}
}

/**
 * Page fragments are client state and must never become Cache API keys. The
 * legacy query form additionally needs its retired private fields removed.
 */
export function getSafePageUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.searchParams.get("action") === "capture") {
			for (const key of LEGACY_CAPTURE_QUERY_KEYS) {
				url.searchParams.delete(key);
			}
		}
		url.hash = "";
		return url.href;
	} catch {
		return null;
	}
}

const SHARE_TARGET_PATH = "/share-target/";
const URL_IN_TEXT = /https?:\/\/\S+/i;

export interface ShareFields {
	title: string;
	text: string;
	url: string;
}

/** The manifest's share_target posts here. The service worker answers it; the network never sees it. */
export function isShareTargetPost(
	pathname: string,
	method: string,
	isSameOrigin: boolean,
): boolean {
	return isSameOrigin && method === "POST" && pathname === SHARE_TARGET_PATH;
}

/**
 * The capture URL for something shared into the app. The content goes in the
 * fragment, which never reaches a request, a log, or a cache key. Many apps
 * share a link inside `text` with no `url`, so a link in the text is used.
 */
export function getShareCaptureUrl(origin: string, fields: ShareFields): string {
	const found = fields.url.trim() || (fields.text.match(URL_IN_TEXT)?.[0] ?? "");
	const rest = found ? fields.text.replace(found, "") : fields.text;
	const heading = fields.title.trim() || rest.replace(/\s+/g, " ").trim();
	if (!heading && !found) return `${origin}/`;

	const params = new URLSearchParams({ action: "capture" });
	if (heading) params.set("title", heading);
	if (found) params.set("url", found);
	return `${origin}/#${params.toString()}`;
}

export function getEvictionCandidates<T>(keys: T[], maxEntries: number): T[] {
	if (keys.length <= maxEntries) {
		return [];
	}
	return keys.slice(0, keys.length - maxEntries);
}
