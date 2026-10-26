import { test as base } from "@playwright/test";
import { withFirefoxTestHome } from "../../../scripts/lib/firefox-test-home.cjs";

// Firefox reports an aborted local font request as console.error when a test
// navigates while a font response is still in flight. That happens on the dev
// server (localhost:3000) and on the static export server (127.0.0.1:3100).
// 2152398850 is NS_BINDING_ABORTED; keep this fingerprint deliberately narrow
// so missing fonts, non-local URLs, and every application error still fail.
// The filename class includes `_` because Turbopack's hashed asset names carry
// underscores (26aa48c1bdeb5547-s.p.30a_ou6vtcpon.woff2); without it this stops
// matching and the aborted-font diagnostic fails tests again.
// Firefox renamed font-stretch to font-width, so the descriptor reads `width:100`
// in current builds and `stretch:100` in older ones; the pattern accepts both.
const FIREFOX_ABORTED_LOCAL_FONT = /^\[JavaScript Error: "downloadable font: download failed \(font-family: "[^"]+" style:[^ ]+ weight:[^ ]+ (?:stretch|width):100 src index:0\): status=2152398850 source: http:\/\/(?:localhost:3000|127\.0\.0\.1:3100)\/(?:_next\/static\/media\/[a-z0-9._-]+|__nextjs_font\/[a-z0-9._-]+)\.woff2"\]$/;

// WebKit reports a route prefetch that a test's page.goto cancels as an uncaught
// "access control checks" fetch error. Only production builds prefetch, so this
// appears only on the static export server, and only for the router's
// `__next.*.txt` payloads; the new page fetches the same files again. Any other
// failed fetch, origin, or file still fails the test.
const WEBKIT_ABORTED_LOCAL_PREFETCH = /^Fetch API cannot load http:\/\/127\.0\.0\.1:3100\/(?:[a-z0-9-]+\/)*__next\.[^/?\s]+\.txt\?_rsc=[A-Za-z0-9_-]+ due to access control checks\.$/;

function isExpectedBrowserDiagnostic(message: string): boolean {
  return FIREFOX_ABORTED_LOCAL_FONT.test(message) || WEBKIT_ABORTED_LOCAL_PREFETCH.test(message);
}

/**
 * Clears IndexedDB before the test runs so the suite starts from a clean slate.
 * We navigate to the app origin first because IndexedDB is keyed per-origin.
 * The Dexie database name comes from lib/db.ts (`GsdTaskManager`).
 */
type TestFixtures = {
  clearIndexedDB: void;
  firstTimeVisitor: boolean;
  serviceWorkerEnabled: boolean;
  runtimeErrors: void;
  /**
   * Console errors the test causes on purpose — aborting a route, for one —
   * which the browser reports as an error but which are not app faults.
   * Opt in per test with `test.use()`; the guard stays strict everywhere else.
   *
   * One pattern rather than an array: Playwright reads a two-element array as
   * a [value, options] fixture tuple, so `[/a/, /b/]` would arrive as `/a/`.
   */
  expectedConsoleErrors: RegExp | null;
};

export const test = base.extend<TestFixtures>({
  launchOptions: [
    async ({ browserName, launchOptions }, runTest) => {
      await withFirefoxTestHome(browserName, async (env: Record<string, string> | undefined) => {
        await runTest(env ? {
          ...launchOptions,
          env: { ...process.env, ...launchOptions.env, ...env },
        } : launchOptions);
      });
    },
    { scope: "worker" },
  ],
  firstTimeVisitor: [false, { option: true }],
  serviceWorkerEnabled: [false, { option: true }],
  expectedConsoleErrors: [null, { option: true }],
  runtimeErrors: [
    async ({ page, expectedConsoleErrors }, runTest, testInfo) => {
      const runtimeErrors: string[] = [];
      const onPageError = (error: Error) => {
        // Playwright splits WebKit's error text at its first colon, which here
        // falls inside the URL, so only the stack's first line holds it whole.
        const firstLine = (error.stack ?? error.message).split("\n")[0];
        if (isExpectedBrowserDiagnostic(firstLine)) return;
        runtimeErrors.push(`pageerror: ${error.stack ?? error.message}`);
      };
      const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (isExpectedBrowserDiagnostic(text)) return;
        if (expectedConsoleErrors?.test(text)) return;
        runtimeErrors.push(`console.error: ${text}`);
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
  clearIndexedDB: async ({ page, firstTimeVisitor, serviceWorkerEnabled }, runTest) => {
    // Pre-seed the first-visit flag so FirstTimeRedirect never fires in tests.
    // Without this, the redirect to /about races page.goto("/") and WebKit
    // throws "interrupted by another navigation" (Chromium/Firefox tolerate it).
    await page.addInitScript(({ preserveFirstVisit, enableServiceWorker }) => {
      if (!preserveFirstVisit) {
        window.localStorage.setItem("gsd-has-launched", "true");
        // Suppress the welcome tour overlay so it never blocks app-level specs.
        window.localStorage.setItem("gsd-onboarding-seen", "true");
      }
      // Ordinary app specs exercise runtime behavior without a real worker.
      // Removing the capability makes the production feature-detection path
      // return early instead of letting Playwright's blocked registration
      // surface as an application error.
      if (!enableServiceWorker) Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
    }, { preserveFirstVisit: firstTimeVisitor, enableServiceWorker: serviceWorkerEnabled });
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
