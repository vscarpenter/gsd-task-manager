#!/usr/bin/env node

const { createServer } = require("node:http");
const { existsSync, readFileSync, statSync } = require("node:fs");
const { extname, join, normalize, resolve } = require("node:path");
const { chromium } = require("@playwright/test");

const outputRoot = resolve("out");
const policy = JSON.parse(readFileSync("cloudfront/response-headers-policy.json", "utf8"));
const contentSecurityPolicy =
  policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
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

async function main() {
  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error("Production CSP smoke test requires an existing out/index.html build.");
  }

  const server = createServer((request, response) => {
    const target = resolveRequestPath(request.url ?? "/");
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(target)] ?? "application/octet-stream",
      "Content-Security-Policy": contentSecurityPolicy,
      "Cache-Control": "no-store",
    });
    response.end(readFileSync(target));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to bind CSP smoke server.");

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  await page.addInitScript(() => {
    window.__gsdCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__gsdCspViolations.push({
        blocked: event.blockedURI,
        directive: event.effectiveDirective,
        line: event.lineNumber,
        sample: event.sample,
        source: event.sourceFile,
      });
    });
    localStorage.setItem("gsd-has-launched", "true");
    localStorage.setItem("gsd-onboarding-seen", "true");
  });

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });
    await page.getByTestId("capture-input").waitFor({ state: "visible", timeout: 15_000 });
    const externalizedResources = await page.evaluate(() =>
      performance.getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.includes("/_next/static/csp-inline/")).length
    );
    const violationDetails = await page.evaluate(() => ({
      violations: window.__gsdCspViolations,
      styles: [...document.querySelectorAll("style")].map((style) =>
        (style.textContent ?? "").slice(0, 120)
      ),
    }));
    if (violationDetails.violations.length > 0) {
      failures.push(`violations: ${JSON.stringify(violationDetails)}`);
    }
    if (externalizedResources === 0) failures.push("no externalized Next bootstrap assets loaded");
    if (failures.length > 0) throw new Error(failures.join("\n"));
    process.stdout.write(`Production CSP browser smoke passed with ${externalizedResources} externalized assets.\n`);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
