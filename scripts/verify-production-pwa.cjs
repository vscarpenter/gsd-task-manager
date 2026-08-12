#!/usr/bin/env node

const { createServer } = require("node:http");
const { existsSync, readFileSync, statSync } = require("node:fs");
const { extname, join, normalize, resolve } = require("node:path");
const { chromium, firefox, webkit } = require("@playwright/test");

const outputRoot = resolve("out");
const supportedBrowsers = { chromium, firefox, webkit };
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const safePath = normalize(pathname).replace(/^(?:\.\.(?:\/|\\|$))+/, "");
  let target = join(outputRoot, safePath);
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
  if (!existsSync(target)) target = join(outputRoot, "index.html");
  return target;
}

async function startStaticServer() {
  const server = createServer((request, response) => {
    const target = resolveRequestPath(request.url ?? "/");
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(readFileSync(target));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolveClose) => server.close(resolveClose));
    throw new Error("Unable to bind production PWA smoke server.");
  }
  return { server, rootUrl: `http://127.0.0.1:${address.port}` };
}

async function waitForServiceWorkerControl(page) {
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === "activated";
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function assertCacheBoundaries(page, rootUrl) {
  const details = await page.evaluate(async (apiUrl) => {
    const response = await fetch(apiUrl, { headers: { authorization: "Bearer audit-probe" } });
    const names = await caches.keys();
    const entries = await Promise.all(
      names.map(async (name) => {
        const cache = await caches.open(name);
        return { name, urls: (await cache.keys()).map((key) => key.url) };
      })
    );
    return {
      apiStatus: response.status,
      cacheNames: names,
      entries,
      apiCached: Boolean(await caches.match(apiUrl)),
    };
  }, `${rootUrl}/api/pwa-audit-probe`);

  if (details.apiStatus !== 200) throw new Error(`API cache probe returned ${details.apiStatus}.`);
  if (!details.cacheNames.some((name) => name.startsWith("gsd-pages-v"))) {
    throw new Error(`Missing page cache: ${details.cacheNames.join(", ")}`);
  }
  if (!details.cacheNames.some((name) => name.startsWith("gsd-runtime-v"))) {
    throw new Error(`Missing runtime cache: ${details.cacheNames.join(", ")}`);
  }
  if (details.apiCached) throw new Error("Authorized /api/ cache probe was cached.");
  const cachedUrls = details.entries.flatMap((entry) => entry.urls);
  if (cachedUrls.some((url) => new URL(url).pathname.startsWith("/api/"))) {
    throw new Error("An /api/ response was written to CacheStorage.");
  }
  if (cachedUrls.some((url) => new URL(url).searchParams.get("action") === "capture")) {
    throw new Error("A legacy capture payload was written to CacheStorage.");
  }
}

async function verifyBrowser(browserName, rootUrl, server) {
  const browserType = supportedBrowsers[browserName];
  if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);
  const browser = await browserType.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const diagnostics = [];
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      diagnostics.push(`console: ${message.text()} (${location.url}:${location.lineNumber})`);
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("gsd-has-launched", "true");
    localStorage.setItem("gsd-onboarding-seen", "true");
  });

  try {
    await page.goto(`${rootUrl}/`, { waitUntil: "networkidle" });
    await page.getByTestId("capture-input").waitFor({ state: "visible", timeout: 15_000 });
    await waitForServiceWorkerControl(page);
    await assertCacheBoundaries(page, rootUrl);

    diagnostics.length = 0;
    await new Promise((resolveClose) => server.close(resolveClose));
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.getByTestId("capture-input").waitFor({ state: "visible", timeout: 15_000 });
    if (diagnostics.length > 0) throw new Error(diagnostics.join("\n"));
    process.stdout.write(`Production PWA lifecycle passed in ${browserName}.\n`);
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error("Production PWA test requires an existing out/index.html build.");
  }
  const browserNames = process.argv.slice(2);
  const targets = browserNames.length > 0 ? browserNames : Object.keys(supportedBrowsers);
  for (const browserName of targets) {
    const { server, rootUrl } = await startStaticServer();
    try {
      await verifyBrowser(browserName, rootUrl, server);
    } finally {
      if (server.listening) {
        await new Promise((resolveClose) => server.close(resolveClose));
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
