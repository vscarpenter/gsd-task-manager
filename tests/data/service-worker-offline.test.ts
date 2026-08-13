import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

type WorkerListener = (event: Record<string, unknown>) => void;

interface StoredEntry {
	request: Request;
	response: Response;
}

interface MatchOptions {
	ignoreVary?: boolean;
}

const ORIGIN = "https://gsd.test";

// CloudFront's agent-discovery response function appends `Accept` to Vary so
// that /path and /path.md can be content-negotiated. Page responses therefore
// carry this header in production; runtime assets do not.
const PAGE_VARY = "Accept-Encoding, Accept";

const NAVIGATION_ACCEPT =
	"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

/**
 * Cache entry matching that honours Vary the way the browser Cache API does:
 * for every header named in the stored response's Vary, the incoming request's
 * value must equal the value on the request that was stored alongside it.
 */
function entryMatches(
	entry: StoredEntry,
	request: Request,
	options?: MatchOptions,
): boolean {
	if (entry.request.url !== request.url) {
		return false;
	}
	if (options?.ignoreVary) {
		return true;
	}
	const vary = entry.response.headers.get("vary");
	if (!vary) {
		return true;
	}
	return vary
		.split(",")
		.map((header) => header.trim().toLowerCase())
		.every(
			(header) =>
				entry.request.headers.get(header) === request.headers.get(header),
		);
}

function toRequest(input: Request | string): Request {
	return typeof input === "string"
		? new Request(new URL(input, `${ORIGIN}/`).href)
		: input;
}

function createCache(entries: StoredEntry[]) {
	return {
		addAll: vi.fn().mockResolvedValue(undefined),
		put: vi.fn().mockResolvedValue(undefined),
		keys: vi.fn().mockResolvedValue(entries.map((entry) => entry.request)),
		delete: vi.fn().mockResolvedValue(true),
		match: vi.fn(async (input: Request | string, options?: MatchOptions) => {
			const request = toRequest(input);
			return entries.find((entry) => entryMatches(entry, request, options))
				?.response;
		}),
	};
}

interface Harness {
	listeners: Map<string, WorkerListener>;
	fetchMock: ReturnType<typeof vi.fn>;
	respond: (request: Request) => Promise<unknown>;
}

/**
 * Boots public/sw.js against a cache that already holds the precached pages,
 * exactly as it exists in production: stored by cache.addAll() (so the stored
 * request carries no Accept header) with a Vary: Accept response.
 */
function createHarness(entries: StoredEntry[]): Harness {
	const listeners = new Map<string, WorkerListener>();
	const cache = createCache(entries);
	const cacheStorage = {
		open: vi.fn().mockResolvedValue(cache),
		keys: vi.fn().mockResolvedValue([]),
		delete: vi.fn().mockResolvedValue(true),
		match: cache.match,
	};
	// Offline: every network request rejects, as fetch() does with no network.
	const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
	const clients = {
		claim: vi.fn().mockResolvedValue(undefined),
		matchAll: vi.fn().mockResolvedValue([]),
		openWindow: vi.fn(),
	};
	const self = {
		location: { origin: ORIGIN },
		registration: { scope: `${ORIGIN}/`, showNotification: vi.fn() },
		navigator: {},
		clients,
		skipWaiting: vi.fn().mockResolvedValue(undefined),
		addEventListener: (type: string, listener: WorkerListener) => {
			listeners.set(type, listener);
		},
	};

	const context = vm.createContext({
		URL,
		URLSearchParams,
		Request,
		Response,
		Headers,
		Promise,
		console,
		caches: cacheStorage,
		clients,
		fetch: fetchMock,
		importScripts: vi.fn(),
		self,
	});
	vm.runInContext(
		readFileSync(resolve(__dirname, "../../public/sw-cache-logic.js"), "utf8"),
		context,
	);
	vm.runInContext(
		readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8"),
		context,
	);

	const respond = (request: Request) => {
		let responsePromise: Promise<unknown> | undefined;
		listeners.get("fetch")?.({
			request,
			respondWith: (promise: Promise<unknown>) => {
				responsePromise = promise;
			},
		});
		return Promise.resolve(responsePromise);
	};

	return { listeners, fetchMock, respond };
}

function precachedPage(path: string, body: string): StoredEntry {
	return {
		// cache.addAll() stores a request with no Accept header.
		request: new Request(`${ORIGIN}${path}`),
		response: new Response(body, {
			status: 200,
			headers: { vary: PAGE_VARY, "content-type": "text/html" },
		}),
	};
}

function navigationRequest(path: string): Request {
	const request = new Request(`${ORIGIN}${path}`, {
		headers: { accept: NAVIGATION_ACCEPT },
	});
	Object.defineProperty(request, "mode", { value: "navigate" });
	return request;
}

describe("service worker offline fallback", () => {
	it("serves the precached page when the network is unavailable", async () => {
		const harness = createHarness([
			precachedPage("/", "<!doctype html>ROOT"),
			precachedPage("/dashboard/", "<!doctype html>DASHBOARD"),
		]);

		const response = await harness.respond(navigationRequest("/dashboard/"));

		expect(response).toBeInstanceOf(Response);
		await expect((response as Response).text()).resolves.toContain("DASHBOARD");
	});

	it("resolves with a Response when a page is not cached at all", async () => {
		const harness = createHarness([]);

		const response = await harness.respond(navigationRequest("/dashboard/"));

		// respondWith(undefined) throws "Failed to convert value to 'Response'"
		// and turns the navigation into a hard network error.
		expect(response).toBeInstanceOf(Response);
	});

	it("resolves with a Response when a hashed asset is not cached", async () => {
		const harness = createHarness([]);

		const response = await harness.respond(
			new Request(`${ORIGIN}/_next/static/chunks/main-abc123.js`),
		);

		expect(response).toBeInstanceOf(Response);
	});

	it("resolves with a Response when a runtime asset is not cached", async () => {
		const harness = createHarness([]);

		const response = await harness.respond(
			new Request(`${ORIGIN}/icons/icon-192.png`),
		);

		expect(response).toBeInstanceOf(Response);
	});

	it("still prefers the network response when the network is available", async () => {
		const harness = createHarness([
			precachedPage("/dashboard/", "<!doctype html>STALE"),
		]);
		harness.fetchMock.mockResolvedValue(
			new Response("<!doctype html>FRESH", { status: 200 }),
		);

		const response = await harness.respond(navigationRequest("/dashboard/"));

		expect(response).toBeInstanceOf(Response);
		await expect((response as Response).text()).resolves.toContain("FRESH");
	});
});
