import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	classifyRequest,
	getCacheNames,
	shouldDeleteCache,
	getEvictionCandidates,
} from "@/lib/sw-cache-logic";

describe("classifyRequest", () => {
	it("should return immutable for /_next/static/chunks/*.js", () => {
		expect(
			classifyRequest("/_next/static/chunks/0-a349cgetoh4.js", null, true, "GET"),
		).toBe("immutable");
	});

	it("should return immutable for /_next/static/chunks/*.css", () => {
		expect(
			classifyRequest("/_next/static/chunks/styles-abc123.css", null, true, "GET"),
		).toBe("immutable");
	});

	it("should return immutable for /_next/static/{buildId}/_buildManifest.js", () => {
		expect(
			classifyRequest(
				"/_next/static/_zrEi3OuxXcRwG__wU8cr/_buildManifest.js",
				null,
				true,
				"GET",
			),
		).toBe("immutable");
	});

	it("should return pages for HTML requests (accept: text/html)", () => {
		expect(
			classifyRequest("/dashboard/", "text/html,application/xhtml+xml", true, "GET"),
		).toBe("pages");
	});

	it("should return pages for URLs ending in /", () => {
		expect(classifyRequest("/settings/", null, true, "GET")).toBe("pages");
	});

	it("should return pages for URLs ending in .html", () => {
		expect(classifyRequest("/404.html", null, true, "GET")).toBe("pages");
	});

	it("should return pages for RSC flight data (/__next. URLs)", () => {
		expect(
			classifyRequest("/__next._tree.txt", null, true, "GET"),
		).toBe("pages");
	});

	it("should return runtime for /manifest.json", () => {
		expect(classifyRequest("/manifest.json", null, true, "GET")).toBe(
			"runtime",
		);
	});

	it("should return runtime for /icons/*.png", () => {
		expect(classifyRequest("/icons/icon-192.png", null, true, "GET")).toBe(
			"runtime",
		);
	});

	it("should return passthrough for same-origin API requests", () => {
		expect(
			classifyRequest("/api/collections/tasks/records", null, true, "GET"),
		).toBe("passthrough");
	});

	it("should return passthrough for PocketBase admin requests", () => {
		expect(classifyRequest("/_/", "text/html", true, "GET")).toBe(
			"passthrough",
		);
	});

	it("should return passthrough for auth-bearing requests", () => {
		expect(
			classifyRequest("/manifest.json", null, true, "GET", true),
		).toBe("passthrough");
	});

	it("should return passthrough for no-store requests", () => {
		expect(
			classifyRequest("/manifest.json", null, true, "GET", false, "no-store"),
		).toBe("passthrough");
	});

	it("should return passthrough for unknown same-origin runtime requests", () => {
		expect(classifyRequest("/robots.txt", null, true, "GET")).toBe(
			"passthrough",
		);
	});

	it("should return passthrough for cross-origin requests", () => {
		expect(
			classifyRequest("/api/collections/tasks", null, false, "GET"),
		).toBe("passthrough");
	});

	it("should return passthrough for non-GET requests", () => {
		expect(classifyRequest("/api/tasks", null, true, "POST")).toBe(
			"passthrough",
		);
	});

	it("should return passthrough for cross-origin non-GET requests", () => {
		expect(classifyRequest("/api/tasks", null, false, "POST")).toBe(
			"passthrough",
		);
	});
});

describe("getCacheNames", () => {
	it("should return three cache names with version embedded", () => {
		const names = getCacheNames("9.3.4", 1);
		expect(names).toEqual({
			immutable: "gsd-immutable-v1",
			pages: "gsd-pages-v9.3.4",
			runtime: "gsd-runtime-v9.3.4",
		});
	});

	it("should keep immutable version separate from deploy version", () => {
		const names = getCacheNames("10.0.0", 1);
		expect(names.immutable).toBe("gsd-immutable-v1");
		expect(names.pages).toBe("gsd-pages-v10.0.0");
		expect(names.runtime).toBe("gsd-runtime-v10.0.0");
	});
});

describe("shouldDeleteCache", () => {
	const currentNames = getCacheNames("9.3.4", 1);

	it("should return true for old gsd-cache-v* single-cache format (migration)", () => {
		expect(shouldDeleteCache("gsd-cache-v9.3.3", currentNames)).toBe(true);
	});

	it("should return true for outdated gsd-pages-v* caches", () => {
		expect(shouldDeleteCache("gsd-pages-v9.3.3", currentNames)).toBe(true);
	});

	it("should return true for outdated gsd-runtime-v* caches", () => {
		expect(shouldDeleteCache("gsd-runtime-v9.3.3", currentNames)).toBe(true);
	});

	it("should return false for current pages cache", () => {
		expect(shouldDeleteCache("gsd-pages-v9.3.4", currentNames)).toBe(false);
	});

	it("should return false for current runtime cache", () => {
		expect(shouldDeleteCache("gsd-runtime-v9.3.4", currentNames)).toBe(false);
	});

	it("should return false for current immutable cache", () => {
		expect(shouldDeleteCache("gsd-immutable-v1", currentNames)).toBe(false);
	});

	it("should return false for unrecognized cache names (not ours)", () => {
		expect(shouldDeleteCache("workbox-precache-v2", currentNames)).toBe(
			false,
		);
	});

	it("should return true for old immutable cache version", () => {
		const names = getCacheNames("9.3.4", 2);
		expect(shouldDeleteCache("gsd-immutable-v1", names)).toBe(true);
	});
});

describe("getEvictionCandidates", () => {
	it("should return empty array when under limit", () => {
		expect(getEvictionCandidates(["a", "b"], 5)).toEqual([]);
	});

	it("should return empty array when at exact limit", () => {
		expect(getEvictionCandidates(["a", "b", "c"], 3)).toEqual([]);
	});

	it("should return oldest keys when over limit (FIFO order)", () => {
		expect(getEvictionCandidates(["a", "b", "c", "d", "e"], 3)).toEqual([
			"a",
			"b",
		]);
	});

	it("should return correct count to bring entries within limit", () => {
		const keys = Array.from({ length: 65 }, (_, i) => `chunk-${i}.js`);
		const candidates = getEvictionCandidates(keys, 60);
		expect(candidates).toHaveLength(5);
		expect(candidates[0]).toBe("chunk-0.js");
		expect(candidates[4]).toBe("chunk-4.js");
	});

	it("should handle empty keys array", () => {
		expect(getEvictionCandidates([], 60)).toEqual([]);
	});
});

describe("source sync check", () => {
	it("should have matching function signatures in public/sw-cache-logic.js and lib/sw-cache-logic.ts", () => {
		const jsPath = resolve(__dirname, "../../public/sw-cache-logic.js");
		const tsPath = resolve(__dirname, "../../lib/sw-cache-logic.ts");
		const jsSource = readFileSync(jsPath, "utf-8");
		const tsSource = readFileSync(tsPath, "utf-8");

		const extractFunctionNames = (source: string): string[] =>
			[...source.matchAll(/(?:export )?function (\w+)[<(]/g)].map((m) => m[1]).sort();

		const jsFunctions = extractFunctionNames(jsSource);
		const tsFunctions = extractFunctionNames(tsSource);

		expect(jsFunctions).toEqual(tsFunctions);
	});

	it("should produce identical results from both sources", () => {
		// Verify the JS file is loadable and its functions produce the same
		// results as the TS source — catches logic drift between the two files.
		const jsPath = resolve(__dirname, "../../public/sw-cache-logic.js");
		const jsSource = readFileSync(jsPath, "utf-8");

		// Extract and execute JS functions in a clean scope
		const jsModule: Record<string, unknown> = {};
		const wrappedCode = `(function(module, exports) { ${jsSource} })`;
		 
		const factory = (0, eval)(wrappedCode) as (m: { exports: Record<string, unknown> }, e: Record<string, unknown>) => void;
		const mod = { exports: jsModule };
		factory(mod, jsModule);
		const js = mod.exports as typeof import("@/lib/sw-cache-logic");

		// Compare outputs for representative inputs
		expect(js.classifyRequest("/_next/static/chunks/a.js", null, true, "GET")).toBe(
			classifyRequest("/_next/static/chunks/a.js", null, true, "GET"),
		);
		expect(js.classifyRequest("/about/", "text/html", true, "GET")).toBe(
			classifyRequest("/about/", "text/html", true, "GET"),
		);
		expect(js.classifyRequest("/manifest.json", null, true, "GET")).toBe(
			classifyRequest("/manifest.json", null, true, "GET"),
		);
		expect(js.classifyRequest("/api/x", null, false, "GET")).toBe(
			classifyRequest("/api/x", null, false, "GET"),
		);
		expect(js.classifyRequest("/api/x", null, true, "GET")).toBe(
			classifyRequest("/api/x", null, true, "GET"),
		);
		expect(js.classifyRequest("/robots.txt", null, true, "GET")).toBe(
			classifyRequest("/robots.txt", null, true, "GET"),
		);
		expect(js.getCacheNames("1.0.0", 1)).toEqual(getCacheNames("1.0.0", 1));
		expect(js.shouldDeleteCache("gsd-cache-v1", js.getCacheNames("2.0.0", 1))).toBe(
			shouldDeleteCache("gsd-cache-v1", getCacheNames("2.0.0", 1)),
		);
		expect(js.getEvictionCandidates(["a", "b", "c"], 2)).toEqual(
			getEvictionCandidates(["a", "b", "c"], 2),
		);
	});
});
