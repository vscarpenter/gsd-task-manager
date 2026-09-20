#!/usr/bin/env node

const { chromium } = require("@playwright/test");
const { readProductionCsp, startStaticExportServer } = require("./lib/static-export-server.cjs");

async function main() {
  const { server, rootUrl } = await startStaticExportServer({ csp: readProductionCsp() });

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
    await page.goto(`${rootUrl}/`, { waitUntil: "networkidle" });
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
