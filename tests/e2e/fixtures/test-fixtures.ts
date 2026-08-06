import { test as base } from "@playwright/test";

// Firefox reports an aborted local font request as console.error when a test
// navigates while Next's development font response is still in flight.
// 2152398850 is NS_BINDING_ABORTED; keep this fingerprint deliberately narrow
// so missing fonts, non-local URLs, and every application error still fail.
const FIREFOX_ABORTED_DEV_FONT = /^\[JavaScript Error: "downloadable font: download failed \(font-family: "[^"]+" style:[^ ]+ weight:[^ ]+ stretch:100 src index:0\): status=2152398850 source: http:\/\/localhost:3000\/(?:_next\/static\/media\/[a-z0-9.-]+|__nextjs_font\/[a-z0-9.-]+)\.woff2"\]$/;

function isExpectedBrowserDiagnostic(message: string): boolean {
  return FIREFOX_ABORTED_DEV_FONT.test(message);
}

/**
 * Clears IndexedDB before the test runs so the suite starts from a clean slate.
 * We navigate to the app origin first because IndexedDB is keyed per-origin.
 * The Dexie database name comes from lib/db.ts (`GsdTaskManager`).
 */
type TestFixtures = {
  clearIndexedDB: void;
  firstTimeVisitor: boolean;
  runtimeErrors: void;
};

export const test = base.extend<TestFixtures>({
  firstTimeVisitor: [false, { option: true }],
  runtimeErrors: [
    async ({ page }, runTest, testInfo) => {
      const runtimeErrors: string[] = [];
      const onPageError = (error: Error) => {
        runtimeErrors.push(`pageerror: ${error.stack ?? error.message}`);
      };
      const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
        if (message.type() === "error" && !isExpectedBrowserDiagnostic(message.text())) {
          runtimeErrors.push(`console.error: ${message.text()}`);
        }
      };

      page.on("pageerror", onPageError);
      page.on("console", onConsole);
      await runTest();
      page.off("pageerror", onPageError);
      page.off("console", onConsole);

      if (runtimeErrors.length > 0) {
        const evidence = runtimeErrors.join("\n\n");
        await testInfo.attach("browser-runtime-errors", {
          body: evidence,
          contentType: "text/plain",
        });
        throw new Error(`Unexpected browser runtime errors:\n${evidence}`);
      }
    },
    { auto: true },
  ],
  // Playwright passes the fixture-runner callback as the second arg.
  // We rename it from the conventional `use` to dodge a false-positive
  // react-hooks/rules-of-hooks lint match against React's `use()`.
  clearIndexedDB: async ({ page, firstTimeVisitor }, runTest) => {
    // Pre-seed the first-visit flag so FirstTimeRedirect never fires in tests.
    // Without this, the redirect to /about races page.goto("/") and WebKit
    // throws "interrupted by another navigation" (Chromium/Firefox tolerate it).
    await page.addInitScript(({ preserveFirstVisit }) => {
      if (!preserveFirstVisit) {
        window.localStorage.setItem("gsd-has-launched", "true");
        // Suppress the welcome tour overlay so it never blocks app-level specs.
        window.localStorage.setItem("gsd-onboarding-seen", "true");
      }
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
    }, { preserveFirstVisit: firstTimeVisitor });
    // Establish the app origin without booting application code. Loading the
    // real page first opens Dexie, which can block its own deletion and made
    // the old fixture incorrectly resolve a dirty database as success.
    await page.route("**/*", async (route) => {
      await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>E2E setup</title>" });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.unroute("**/*");
    if (firstTimeVisitor) {
      await page.evaluate(() => {
        window.localStorage.removeItem("gsd-has-launched");
        window.localStorage.removeItem("gsd-onboarding-seen");
      });
    }
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
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
    } catch (error) {
      // The dedicated first-visit case intentionally triggers a client-side
      // redirect while page.goto is settling. Other tests must still fail on
      // any unexpected navigation interruption.
      if (!firstTimeVisitor) throw error;
      await page.waitForURL(/\/about\/?(?:[?#].*)?$/, { timeout: 10000 });
    }
    await runTest();
  },
});

export const expect = test.expect;
