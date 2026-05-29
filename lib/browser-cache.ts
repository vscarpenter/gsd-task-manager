const APP_CACHE_PREFIX = "gsd-";

/**
 * Delete Cache Storage entries created by this app's service worker.
 */
export async function clearAppCaches(): Promise<string[]> {
	if (typeof globalThis === "undefined" || !("caches" in globalThis)) {
		return [];
	}

	const cacheStorage = globalThis.caches;
	const cacheNames = await cacheStorage.keys();
	const appCacheNames = cacheNames.filter((name) =>
		name.startsWith(APP_CACHE_PREFIX),
	);

	const deleted = await Promise.all(
		appCacheNames.map(async (name) => {
			const wasDeleted = await cacheStorage.delete(name);
			return wasDeleted ? name : null;
		}),
	);

	return deleted.filter((name): name is string => name !== null);
}
