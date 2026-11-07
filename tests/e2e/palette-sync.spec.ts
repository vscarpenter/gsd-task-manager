import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Turns sync on the way a signed-in device has it: an enabled config in IndexedDB and a
 * PocketBase auth token that hasn't expired. The app counts sync as on only with both.
 */
async function enableSyncConfig(page: Page): Promise<void> {
  await page.evaluate(() => {
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const token = [encode({ alg: "HS256", typ: "JWT" }), encode({ id: "user-1", type: "auth", exp: Math.floor(Date.now() / 1000) + 3600 }), "sig"].join(".");
    localStorage.setItem("pocketbase_auth", JSON.stringify({ token, record: { id: "user-1", email: "test@example.com" } }));
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("GsdTaskManager");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("syncMetadata", "readwrite");
          tx.objectStore("syncMetadata").put({
            key: "sync_config", enabled: true, userId: "user-1", deviceId: "device-1", deviceName: "Test device",
            email: "test@example.com", provider: "google", lastSyncAt: null, lastSuccessfulSyncAt: null,
            consecutiveFailures: 0, lastFailureAt: null, lastFailureReason: null, nextRetryAt: null,
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      })
  );
  await page.reload();
  await waitForAppLoad(page);
}

async function openPaletteAndSearch(page: Page, query: string): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("gsd:open-command-palette")));
  await page.getByPlaceholder("Search tasks, actions, settings...").fill(query);
}

test.describe("Command palette: Sync commands follow the real sync state", () => {
  // The sync-on test cuts every request that leaves the app, and each browser words that
  // differently: Chromium says "Failed to load resource ... ERR_FAILED", Firefox says "Cross-Origin
  // Request Blocked" and "can't establish a connection ... /api/realtime", and the production CSP
  // adds its own refusals. Only this suite expects them, and only because it cut the network.
  test.use({
    expectedConsoleErrors:
      /Failed to load resource|ERR_FAILED|ERR_CONNECTION_REFUSED|Cross-Origin Request Blocked|establish a connection|Refused to connect|Content[- ]Security[- ]Policy|\/api\/realtime/,
  });

  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix.
  });

  test("hides Sync commands while sync is off", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);

    await openPaletteAndSearch(page, "sync");

    await expect(page.getByRole("option", { name: /Sync now/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /View sync history/ })).toHaveCount(0);
  });

  test("shows Sync now and View sync history once sync is on, and the history command opens the page", async ({ page, baseURL }) => {
    // A seeded account has no server. Cut every request that leaves the app, so this test can
    // never reach a hosted or local PocketBase, and expect the refusals that causes.
    const appOrigin = new URL(baseURL!).origin;
    await page.route((url) => url.origin !== appOrigin, (route) => route.abort());
    // Belt and braces: nothing outside the app may ever answer.
    const answeredOutsideApp: string[] = [];
    page.on("response", (response) => {
      if (new URL(response.url()).origin !== appOrigin) answeredOutsideApp.push(response.url());
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);
    await enableSyncConfig(page);

    await openPaletteAndSearch(page, "sync");

    await expect(page.getByRole("option", { name: /Sync now/ })).toBeVisible();
    await page.getByRole("option", { name: /View sync history/ }).click();
    await expect(page).toHaveURL(/\/sync-history\/?$/);
    expect(answeredOutsideApp).toEqual([]);
  });
});
