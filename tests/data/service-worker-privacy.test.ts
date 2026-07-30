import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

type WorkerListener = (event: Record<string, unknown>) => void;

interface WorkerHarness {
	listeners: Map<string, WorkerListener>;
	fetchMock: ReturnType<typeof vi.fn>;
	cache: {
		addAll: ReturnType<typeof vi.fn>;
		put: ReturnType<typeof vi.fn>;
		keys: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
}

function createWorkerHarness(cachedRequests: Request[] = []): WorkerHarness {
	const listeners = new Map<string, WorkerListener>();
	const cache = {
		addAll: vi.fn().mockResolvedValue(undefined),
		put: vi.fn().mockResolvedValue(undefined),
		keys: vi.fn().mockResolvedValue(cachedRequests),
		delete: vi.fn().mockResolvedValue(true),
	};
	const cacheStorage = {
		open: vi.fn().mockResolvedValue(cache),
		keys: vi.fn().mockResolvedValue(["gsd-pages-v10.4.1"]),
		delete: vi.fn().mockResolvedValue(true),
		match: vi.fn().mockResolvedValue(undefined),
	};
	const fetchMock = vi
		.fn()
		.mockResolvedValue(new Response("<!doctype html>", { status: 200 }));
	const clients = {
		claim: vi.fn().mockResolvedValue(undefined),
		matchAll: vi.fn().mockResolvedValue([]),
		openWindow: vi.fn(),
	};
	const self = {
		location: { origin: "https://gsd.test" },
		registration: {
			scope: "https://gsd.test/",
			showNotification: vi.fn(),
		},
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
	const helperSource = readFileSync(
		resolve(__dirname, "../../public/sw-cache-logic.js"),
		"utf8",
	);
	const workerSource = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8");
	vm.runInContext(helperSource, context);
	vm.runInContext(workerSource, context);

	return { listeners, fetchMock, cache };
}

describe("service worker capture privacy", () => {
	it("redirects a legacy capture navigation before serving application HTML", async () => {
		const harness = createWorkerHarness();
		const request = new Request(
			"https://gsd.test/?action=capture&title=PRIVATE_SENTINEL&title=SECOND_PRIVATE_SENTINEL&url=https%3A%2F%2Finternal.test%2Fplan%3Fa%3D1%26b%3D2&tags=secret&keep=1&keep=2",
			{ headers: { accept: "text/html" } },
		);
		Object.defineProperty(request, "mode", { value: "navigate" });
		let responsePromise: Promise<Response> | undefined;

		harness.listeners.get("fetch")?.({
			request,
			respondWith: (promise: Promise<Response>) => {
				responsePromise = promise;
			},
		});

		const response = await responsePromise;
		expect(response?.status).toBe(302);
		expect(response?.headers.get("location")).toBe(
			"https://gsd.test/?keep=1&keep=2",
		);
		expect(harness.fetchMock).not.toHaveBeenCalled();
		expect(harness.cache.put).not.toHaveBeenCalled();
	});

	it("never sends or caches a legacy capture payload", async () => {
		const harness = createWorkerHarness();
		const request = new Request(
			"https://gsd.test/?action=capture&title=PRIVATE_SENTINEL&url=https%3A%2F%2Finternal.test%2Fplan&tags=secret&keep=1",
			{ headers: { accept: "text/html" } },
		);
		let responsePromise: Promise<Response> | undefined;

		harness.listeners.get("fetch")?.({
			request,
			respondWith: (promise: Promise<Response>) => {
				responsePromise = promise;
			},
		});

		await responsePromise;
		await vi.waitFor(() => expect(harness.fetchMock).toHaveBeenCalled());
		const networkRequest = harness.fetchMock.mock.calls[0]?.[0] as Request;
		expect(networkRequest.url).toBe("https://gsd.test/?keep=1");
		expect(networkRequest.url).not.toContain("PRIVATE_SENTINEL");

		await vi.waitFor(() => expect(harness.cache.put).toHaveBeenCalled());
		const cacheRequest = harness.cache.put.mock.calls[0]?.[0] as Request;
		expect(cacheRequest.url).toBe("https://gsd.test/?keep=1");
		expect(cacheRequest.url).not.toContain("PRIVATE_SENTINEL");
	});

	it("never caches a client-only capture fragment even if the request retains it", async () => {
		const harness = createWorkerHarness();
		const request = new Request(
			"https://gsd.test/?keep=1#action=capture&title=PRIVATE_FRAGMENT_SENTINEL&url=https%3A%2F%2Finternal.test%2Fplan",
			{ headers: { accept: "text/html" } },
		);
		let responsePromise: Promise<Response> | undefined;

		harness.listeners.get("fetch")?.({
			request,
			respondWith: (promise: Promise<Response>) => {
				responsePromise = promise;
			},
		});

		await responsePromise;
		const networkRequest = harness.fetchMock.mock.calls[0]?.[0] as Request;
		expect(networkRequest.url).toBe("https://gsd.test/?keep=1");

		await vi.waitFor(() => expect(harness.cache.put).toHaveBeenCalled());
		const cacheRequest = harness.cache.put.mock.calls[0]?.[0] as Request;
		expect(cacheRequest.url).toBe("https://gsd.test/?keep=1");
		expect(cacheRequest.url).not.toContain("PRIVATE_FRAGMENT_SENTINEL");
	});

	it("deletes legacy capture entries from the active page cache", async () => {
		const legacyQueryRequest = new Request(
			"https://gsd.test/?action=capture&title=PRIVATE_SENTINEL",
		);
		const legacyFragmentRequest = new Request(
			"https://gsd.test/#action=capture&title=PRIVATE_FRAGMENT_SENTINEL",
		);
		const safeRequest = new Request("https://gsd.test/");
		const harness = createWorkerHarness([
			legacyQueryRequest,
			legacyFragmentRequest,
			safeRequest,
		]);
		let activationPromise: Promise<unknown> | undefined;

		harness.listeners.get("activate")?.({
			waitUntil: (promise: Promise<unknown>) => {
				activationPromise = promise;
			},
		});

		await activationPromise;
		expect(harness.cache.delete).toHaveBeenCalledWith(legacyQueryRequest);
		expect(harness.cache.delete).toHaveBeenCalledWith(legacyFragmentRequest);
		expect(harness.cache.delete).not.toHaveBeenCalledWith(safeRequest);
	});
});
