const SITE = "https://gsd.vinny.dev";
const HEALTH = "https://api.vinny.io/api/health";
const CHECKS = ["website", "service-worker", "bootstrap-asset", "pocketbase"];
const CODES = new Set([
  "OK", "HTTP_STATUS", "CONTENT_TYPE", "CACHE_POLICY", "PAGE_IDENTITY",
  "BUILD_VERSION", "HEALTH_RESPONSE", "BODY_LIMIT", "TIMEOUT", "NETWORK",
  "DEPENDENCY", "ASSET_LOCATION", "INTERNAL",
]);
const JAVASCRIPT = ["text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"];
const BODY_LIMIT = 262144;
const TIMEOUT_MS = 8000;
const MAX_DURATION_MS = 25000;

class ProbeFailure extends Error {
  constructor(code) {
    super("PublicProbeFailure");
    this.code = code;
  }
}

async function withDeadline(operation, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProbeFailure("TIMEOUT"));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function boundedText(response) {
  if (Number(response.headers.get("content-length")) > BODY_LIMIT) throw new ProbeFailure("BODY_LIMIT");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > BODY_LIMIT) throw new ProbeFailure("BODY_LIMIT");
      parts.push(Buffer.from(value));
    }
    return Buffer.concat(parts).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}

async function publicResponse(url, types, signal, fetchImpl, method = "GET") {
  const response = await fetchImpl(url, {
    method, signal, credentials: "omit", redirect: "manual",
    headers: { "User-Agent": "GSD-Production-Monitor/1.0", Accept: types[0] },
  });
  if (response.status !== 200) throw new ProbeFailure("HTTP_STATUS");
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!types.includes(type)) throw new ProbeFailure("CONTENT_TYPE");
  return response;
}

async function website(signal, fetchImpl) {
  const response = await publicResponse(`${SITE}/`, ["text/html"], signal, fetchImpl);
  if (!/\bno-cache\b/i.test(response.headers.get("cache-control") || "")) throw new ProbeFailure("CACHE_POLICY");
  const text = await boundedText(response);
  if (!/<html\b/i.test(text) || !/<title>[^<]*\bGSD\b[^<]*<\/title>/i.test(text)) throw new ProbeFailure("PAGE_IDENTITY");
  return text;
}

async function worker(signal, fetchImpl) {
  const response = await publicResponse(`${SITE}/sw.js`, JAVASCRIPT, signal, fetchImpl);
  if (!/(?:\bno-cache\b|\bmax-age\s*=\s*0\b)/i.test(response.headers.get("cache-control") || "")) throw new ProbeFailure("CACHE_POLICY");
  const text = await boundedText(response);
  if (!/\bCACHE_VERSION\s*=\s*["']\d+\.\d+\.\d+["']/.test(text)) throw new ProbeFailure("BUILD_VERSION");
}

async function backend(signal, fetchImpl) {
  const response = await publicResponse(HEALTH, ["application/json"], signal, fetchImpl);
  const text = await boundedText(response);
  try {
    const data = JSON.parse(text);
    if (data.code === 200 && typeof data.data === "object" && data.data !== null && Object.keys(data.data).length === 0) return;
  } catch {
    // Only the fixed outcome below leaves this response-validation boundary.
  }
  throw new ProbeFailure("HEALTH_RESPONSE");
}

function selectBootstrapAsset(html) {
  const scripts = html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
  for (const [, src] of scripts) {
    try {
      const url = new URL(src, SITE);
      const allowedPath = /^\/_next\/static\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.js$/.test(url.pathname);
      if (url.origin === SITE && !url.username && !url.password && !url.search && !url.hash && allowedPath) return url.href;
    } catch {
      // Malformed script locations are never requested.
    }
  }
  return null;
}

async function observe(check, operation, timeoutMs) {
  const start = performance.now();
  try {
    const value = await withDeadline(operation, timeoutMs);
    return { value, result: { check, success: true, code: "OK", durationMs: Math.round(performance.now() - start) } };
  } catch (error) {
    const code = error instanceof ProbeFailure && CODES.has(error.code) ? error.code : "NETWORK";
    return { result: { check, success: false, code, durationMs: Math.round(performance.now() - start) } };
  }
}

async function runChecks({ fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const [page, sw, health] = await Promise.all([
    observe("website", (signal) => website(signal, fetchImpl), timeoutMs),
    observe("service-worker", (signal) => worker(signal, fetchImpl), timeoutMs),
    observe("pocketbase", (signal) => backend(signal, fetchImpl), timeoutMs),
  ]);
  const asset = await observe("bootstrap-asset", async (signal) => {
    if (!page.result.success) throw new ProbeFailure("DEPENDENCY");
    const url = selectBootstrapAsset(page.value);
    if (!url) throw new ProbeFailure("ASSET_LOCATION");
    await publicResponse(url, JAVASCRIPT, signal, fetchImpl, "HEAD");
  }, timeoutMs);
  return [page.result, sw.result, asset.result, health.result];
}

function metricHeader(metrics, dimensions, timestamp) {
  return {
    Timestamp: timestamp,
    CloudWatchMetrics: [{ Namespace: "GSD/Production", Dimensions: [dimensions], Metrics: metrics }],
  };
}

function checkEvent(check, result, timestamp) {
  const known = result && CODES.has(result.code);
  const duration = Number.isFinite(result?.durationMs) ? Math.max(0, Math.min(MAX_DURATION_MS, result.durationMs)) : 0;
  return {
    _aws: metricHeader([{ Name: "Success", Unit: "Count" }, { Name: "DurationMs", Unit: "Milliseconds" }], ["Environment", "Check"], timestamp),
    Environment: "production", Check: check,
    Success: known && result.success === true && result.code === "OK" ? 1 : 0,
    DurationMs: duration, FailureCode: known ? result.code : "INTERNAL",
  };
}

function metricEvents(results, timestamp = Date.now()) {
  const byName = new Map(results.map((result) => [result.check, result]));
  const events = CHECKS.map((check) => checkEvent(check, byName.get(check), timestamp));
  events.push({
    _aws: metricHeader([{ Name: "Completed", Unit: "Count" }], ["Environment"], timestamp),
    Environment: "production", Completed: 1,
  });
  return events;
}

function createHandler({ fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS, writeLog = (line) => { process.stdout.write(`${line}\n`); } } = {}) {
  return async function handler(_event = {}) {
    try {
      const results = await runChecks({ fetchImpl, timeoutMs });
      for (const event of metricEvents(results)) writeLog(JSON.stringify(event));
      return { checks: CHECKS.length, failures: results.filter((result) => !result.success).length };
    } catch {
      throw new Error("MonitorInternalFailure");
    }
  };
}

const handler = createHandler();
module.exports = { createHandler, handler, metricEvents, runChecks, selectBootstrapAsset };
