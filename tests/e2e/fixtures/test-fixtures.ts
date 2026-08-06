import { test as base } from "@playwright/test";

/**
 * Clears IndexedDB before the test runs so the suite starts from a clean slate.
 * We navigate to the app origin first because IndexedDB is keyed per-origin.
 * The Dexie database name comes from lib/db.ts (`GsdTaskManager`).
 */
export const test = base.extend<{ clearIndexedDB: void }>({
  // Playwright passes the fixture-runner callback as the second arg.
  // We rename it from the conventional `use` to dodge a false-positive
  // react-hooks/rules-of-hooks lint match against React's `use()`.
  clearIndexedDB: async ({ page }, runTest) => {
    // Pre-seed the first-visit flag so FirstTimeRedirect never fires in tests.
    // Without this, the redirect to /about races page.goto("/") and WebKit
    // throws "interrupted by another navigation" (Chromium/Firefox tolerate it).
    await page.addInitScript(() => {
      window.localStorage.setItem("gsd-has-launched", "true");
      // Suppress the welcome tour overlay so it never blocks app-level specs.
      window.localStorage.setItem("gsd-onboarding-seen", "true");
      // WebKit's Safari user agent starts the app's delayed install banner in
      // every ordinary spec. Dedicated PWA specs dispatch the install event
      // explicitly, while the Safari fallback timer has component coverage.
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value: "Playwright E2E",
      });
      // Ordinary app specs exercise runtime behavior without a real worker.
      // Removing the capability makes the production feature-detection path
      // return early instead of letting Playwright's blocked registration
      // surface as an application error.
      Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
    });
    // Establish the app origin without booting application code. Loading the
    // real page first opens Dexie, which can block its own deletion and made
    // the old fixture incorrectly resolve a dirty database as success.
    await page.route("**/*", async (route) => {
      await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>E2E setup</title>" });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.unroute("**/*");
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase("GsdTaskManager");
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => reject(new Error("IndexedDB deletion was blocked"));
        })
    );
    await page.evaluate(async () => {
      if ("caches" in window) {
        await Promise.all((await caches.keys()).map((cacheName) => caches.delete(cacheName)));
      }
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await runTest();
  },
});

export const expect = test.expect;
