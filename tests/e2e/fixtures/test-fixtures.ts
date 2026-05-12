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
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase("GsdTaskManager");
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => resolve();
        })
    );
    await runTest();
  },
});

export const expect = test.expect;