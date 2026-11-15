import { describe, expect, it, vi } from "vitest";
import {
  createHandler, metricEvents, runChecks, selectBootstrapAsset,
} from "../../monitoring/probe.cjs";

const SITE = "https://gsd.vinny.dev";
const ASSET = `${SITE}/_next/static/chunks/runtime.js`;
const PRIVATE = "PRIVATE_TASK_CONTENT_must_never_leave_the_probe";
const HTML = '<html><head><title>GSD Task Manager</title><script src="/_next/static/chunks/runtime.js"></script></head></html>';

function healthyFetch(overrides: Record<string, () => Response> = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (overrides[url]) return overrides[url]();
    if (url === `${SITE}/`) return new Response(HTML, {
      headers: { "content-type": "text/html", "cache-control": "no-cache,no-store,must-revalidate" },
    });
    if (url === `${SITE}/sw.js`) return new Response("const CACHE_VERSION = '14.9.2';", {
      headers: { "content-type": "text/javascript", "cache-control": "public,max-age=0,must-revalidate" },
    });
    if (url === ASSET) return new Response(null, {
      headers: { "content-type": "text/javascript", "content-length": "120" },
    });
    if (url === "https://api.vinny.io/api/health") return new Response('{"code":200,"data":{}}', {
      headers: { "content-type": "application/json" },
    });
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("production probe", () => {
  it("checks the current public deployment without credentials or task endpoints", async () => {
    const fetchImpl = healthyFetch();
    const results = await runChecks({ fetchImpl });
    expect(results.map((r) => [r.check, r.success])).toEqual([
      ["website", true], ["service-worker", true], ["bootstrap-asset", true], ["pocketbase", true],
    ]);
    expect(fetchImpl.mock.calls.map(([url]) => String(url)).sort()).toEqual([
      `${SITE}/`, `${SITE}/sw.js`, ASSET, "https://api.vinny.io/api/health",
    ].sort());
    for (const [, options] of fetchImpl.mock.calls) {
      expect(options?.credentials).toBe("omit");
      expect(options?.redirect).toBe("manual");
      expect(new Headers(options?.headers).has("authorization")).toBe(false);
      expect(new Headers(options?.headers).has("cookie")).toBe(false);
    }
    expect(fetchImpl.mock.calls.find(([url]) => String(url) === ASSET)?.[1]?.method).toBe("HEAD");
  });

  it("reports a failed page and dependent asset without stopping backend checks", async () => {
    const results = await runChecks({ fetchImpl: healthyFetch({
      [`${SITE}/`]: () => new Response(PRIVATE, { status: 503 }),
    }) });
    expect(results.map((r) => [r.check, r.success, r.code])).toEqual([
      ["website", false, "HTTP_STATUS"], ["service-worker", true, "OK"],
      ["bootstrap-asset", false, "DEPENDENCY"], ["pocketbase", true, "OK"],
    ]);
    expect(JSON.stringify(results)).not.toContain(PRIVATE);
  });

  it("rejects an HTML fallback returned for a JavaScript asset", async () => {
    const results = await runChecks({ fetchImpl: healthyFetch({
      [ASSET]: () => new Response(null, { headers: { "content-type": "text/html" } }),
    }) });
    expect(results.find((r) => r.check === "bootstrap-asset")).toMatchObject({ success: false, code: "CONTENT_TYPE" });
  });

  it.each([
    ["homepage", `${SITE}/`, () => new Response(HTML, { headers: { "content-type": "text/html", "cache-control": "max-age=31536000" } }), "website", "CACHE_POLICY"],
    ["worker cache", `${SITE}/sw.js`, () => new Response("const CACHE_VERSION='14.9.2'", { headers: { "content-type": "text/javascript", "cache-control": "max-age=86400" } }), "service-worker", "CACHE_POLICY"],
    ["dev worker", `${SITE}/sw.js`, () => new Response("const CACHE_VERSION='dev'", { headers: { "content-type": "text/javascript", "cache-control": "max-age=0" } }), "service-worker", "BUILD_VERSION"],
    ["wrong app", `${SITE}/`, () => new Response('<html><title>Another site</title></html>', { headers: { "content-type": "text/html", "cache-control": "no-cache" } }), "website", "PAGE_IDENTITY"],
    ["redirect", `${SITE}/`, () => new Response(null, { status: 302, headers: { location: `https://example.test/${PRIVATE}` } }), "website", "HTTP_STATUS"],
    ["bad health JSON", "https://api.vinny.io/api/health", () => new Response(PRIVATE, { headers: { "content-type": "application/json" } }), "pocketbase", "HEALTH_RESPONSE"],
    ["failed health", "https://api.vinny.io/api/health", () => new Response('{"code":503}', { headers: { "content-type": "application/json" } }), "pocketbase", "HEALTH_RESPONSE"],
  ] as const)("fails closed for %s", async (_label, url, response, check, code) => {
    const results = await runChecks({ fetchImpl: healthyFetch({ [url]: response }) });
    expect(results.find((r) => r.check === check)).toMatchObject({ success: false, code });
    expect(JSON.stringify(results)).not.toContain(PRIVATE);
  });

  it("bounds untrusted public bodies", async () => {
    const results = await runChecks({ fetchImpl: healthyFetch({
      [`${SITE}/`]: () => new Response(HTML + PRIVATE.repeat(10000), {
        headers: { "content-type": "text/html", "cache-control": "no-cache" },
      }),
    }) });
    expect(results.find((r) => r.check === "website")).toMatchObject({ success: false, code: "BODY_LIMIT" });
    expect(JSON.stringify(results)).not.toContain(PRIVATE);
  });

  it("ends stalled requests at the probe deadline", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const results = await runChecks({ fetchImpl, timeoutMs: 10 });
    expect(results.filter((r) => r.check !== "bootstrap-asset").every((r) => r.code === "TIMEOUT")).toBe(true);
    expect(results.every((r) => Number.isFinite(r.durationMs))).toBe(true);
  });

  it("emits only fixed metadata even when events, bodies and errors contain private text", async () => {
    const lines: string[] = [];
    const fetchImpl = healthyFetch({
      [`${SITE}/`]: () => new Response(HTML + PRIVATE, { headers: { "content-type": "text/html", "cache-control": "no-cache", "set-cookie": PRIVATE } }),
      "https://api.vinny.io/api/health": () => { throw new Error(PRIVATE); },
    });
    const handler = createHandler({ fetchImpl, writeLog: (line: string) => lines.push(line) });
    const result = await handler({ title: PRIVATE, authorization: PRIVATE });
    expect(result).toEqual({ checks: 4, failures: 1 });
    expect(lines).toHaveLength(5);
    expect(JSON.stringify({ result, lines })).not.toContain(PRIVATE);
    const events = lines.map((line) => JSON.parse(line));
    for (const event of events.slice(0, 4)) {
      expect(Object.keys(event).sort()).toEqual(["Check", "DurationMs", "Environment", "FailureCode", "Success", "_aws"].sort());
      expect(event._aws.CloudWatchMetrics[0].Namespace).toBe("GSD/Production");
    }
    expect(events[4]).toMatchObject({ Environment: "production", Completed: 1 });
  });

  it("cannot leak unknown dimensions or free-form errors through metric serialization", () => {
    const result = metricEvents([{ check: PRIVATE, success: true, code: PRIVATE, durationMs: Infinity }]);
    expect(JSON.stringify(result)).not.toContain(PRIVATE);
    expect(result.slice(0, 4).every((event) => event.Success === 0)).toBe(true);
    expect(result.slice(0, 4).every((event) => Number.isFinite(event.DurationMs))).toBe(true);
  });

  it("redacts unexpected internal failures before Lambda's error logger sees them", async () => {
    const handler = createHandler({ fetchImpl: healthyFetch(), writeLog: () => { throw new Error(PRIVATE); } });
    await expect(handler({})).rejects.toThrow(/^MonitorInternalFailure$/);
  });
});

describe("bootstrap asset allowlist", () => {
  it("accepts the current build's same-origin script and future build names", () => {
    expect(selectBootstrapAsset(HTML)).toBe(ASSET);
    expect(selectBootstrapAsset('<script src="/_next/static/chunks/app/page-123.js"></script>')).toBe(`${SITE}/_next/static/chunks/app/page-123.js`);
  });

  it.each([
    "https://example.test/_next/static/chunks/runtime.js",
    "http://gsd.vinny.dev/_next/static/chunks/runtime.js",
    "http://169.254.169.254/latest/meta-data/",
    "https://secret@gsd.vinny.dev/_next/static/chunks/runtime.js",
    "/api/collections/tasks/records",
    "/_next/static/../../api/tasks.js",
    "/_next/static/chunks/runtime.js?title=private",
    "/_next/static/chunks/runtime.js#private",
    "/_next/static/chunks/%2fprivate.js",
  ])("never requests disallowed script location %s", async (src) => {
    const html = `<html><title>GSD</title><script src="${src}"></script></html>`;
    expect(selectBootstrapAsset(html)).toBeNull();
    const fetchImpl = healthyFetch({ [`${SITE}/`]: () => new Response(html, {
      headers: { "content-type": "text/html", "cache-control": "no-cache" },
    }) });
    const results = await runChecks({ fetchImpl });
    expect(results.find((r) => r.check === "bootstrap-asset")).toMatchObject({ success: false, code: "ASSET_LOCATION" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
