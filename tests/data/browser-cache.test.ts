import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAppCaches } from "@/lib/browser-cache";

describe("clearAppCaches", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "caches");
	});

	it("deletes only app-owned Cache Storage entries", async () => {
		const deleteCache = vi.fn().mockResolvedValue(true);
		Object.defineProperty(globalThis, "caches", {
			configurable: true,
			value: {
				keys: vi
					.fn()
					.mockResolvedValue([
						"gsd-runtime-v9.3.7",
						"gsd-pages-v9.3.7",
						"workbox-precache-v2",
					]),
				delete: deleteCache,
			},
		});

		await expect(clearAppCaches()).resolves.toEqual([
			"gsd-runtime-v9.3.7",
			"gsd-pages-v9.3.7",
		]);
		expect(deleteCache).toHaveBeenCalledTimes(2);
		expect(deleteCache).not.toHaveBeenCalledWith("workbox-precache-v2");
	});

	it("returns empty when Cache Storage is unavailable", async () => {
		await expect(clearAppCaches()).resolves.toEqual([]);
	});
});
