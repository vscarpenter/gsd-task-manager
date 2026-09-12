/**
 * Reset lock in a real browser: AC11 and AC15, plus AC16 across two tabs.
 *
 * jsdom calls storage listeners synchronously, which hid a cross-tab reload bug
 * that only a real browser's event order exposed. These tests drive the running
 * app, so IndexedDB, localStorage, and the storage event behave as they do for users.
 */

import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

const RESET_PENDING_KEY = "gsd-reset-pending";
const PENDING_MARKER = '{"preserveTheme":true}';
const LOCKED_HEADING = "Reset didn't finish";
const TASK_TITLE = "Private task behind the reset lock";
// sessionStorage survives a same-tab reload, so the new document can read what the old one saw.
const APP_SHOWN_WHILE_LOCKED = "e2e-app-shown-while-locked";

function lockScreen(page: Page) {
  return page.getByRole("main", { name: LOCKED_HEADING });
}

function taskCard(page: Page) {
  return page.locator("[data-testid='task-card']").filter({ hasText: TASK_TITLE });
}

async function setPendingMarker(page: Page): Promise<void> {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [RESET_PENDING_KEY, PENDING_MARKER]);
}

async function removePendingMarker(page: Page): Promise<void> {
  await page.evaluate((key) => localStorage.removeItem(key), RESET_PENDING_KEY);
}

async function readPendingMarker(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), RESET_PENDING_KEY);
}

/** Count task rows in IndexedDB directly, whatever the UI renders. */
async function countStoredTasks(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("GsdTaskManager");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          try {
            const count = db.transaction("tasks").objectStore("tasks").count();
            count.onsuccess = () => resolve(count.result);
            count.onerror = () => reject(count.error);
          } catch (error) {
            reject(error);
          } finally {
            db.close();
          }
        };
      })
  );
}

/** Open a second tab on the app, set up the way the fixture sets up its page. */
async function openSecondTab(context: BrowserContext): Promise<Page> {
  const tab = await context.newPage();
  // The fixture strips the service worker from its own page only. A real worker
  // here could serve cached chunks across the reload this test depends on.
  await tab.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
  });
  await new MatrixPage(tab).goto();
  await waitForAppLoad(tab);
  // Let this document's own load event pass, so the later wait sees only the reload.
  await tab.waitForLoadState("load");
  return tab;
}

/** Flag in sessionStorage if the matrix mounts while this document shows the lock. */
async function watchForAppWhileLocked(page: Page): Promise<void> {
  await page.evaluate((flag) => {
    new MutationObserver(() => {
      if (document.querySelector("[data-testid='matrix-grid']")) sessionStorage.setItem(flag, "true");
    }).observe(document.body, { childList: true, subtree: true });
  }, APP_SHOWN_WHILE_LOCKED);
}

test.describe("Reset lock", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
    await matrixPage.createTask(TASK_TITLE);
  });

  test("should lock the app and hide a stored task when a reset is pending", async ({ page }) => {
    await setPendingMarker(page);

    await page.reload();

    await expect(page.getByRole("heading", { name: LOCKED_HEADING })).toBeVisible();
    await expect(lockScreen(page).getByRole("button")).toHaveCount(1);
    await expect(lockScreen(page).getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByText(TASK_TITLE)).toHaveCount(0);
    expect(await countStoredTasks(page)).toBe(1);
  });

  test("should reload a locked tab without showing the app when another tab unlocks it", async ({ page, context }) => {
    const otherTab = await openSecondTab(context);
    await expect(taskCard(otherTab)).toBeVisible();

    await setPendingMarker(page);
    await expect(lockScreen(otherTab)).toBeVisible();
    await watchForAppWhileLocked(otherTab);

    const reloaded = otherTab.waitForEvent("load");
    await removePendingMarker(page);
    await reloaded;

    await waitForAppLoad(otherTab);
    await expect(taskCard(otherTab)).toBeVisible();
    expect(await otherTab.evaluate((flag) => sessionStorage.getItem(flag), APP_SHOWN_WHILE_LOCKED)).toBeNull();
  });

  test("should delete stored tasks when Try again runs from the lock screen", async ({ page }) => {
    await setPendingMarker(page);
    await page.reload();
    const tryAgain = lockScreen(page).getByRole("button", { name: "Try again" });
    await expect(tryAgain).toBeVisible();

    const reloaded = page.waitForEvent("load");
    await tryAgain.click();
    await reloaded;

    await waitForAppLoad(page);
    await expect(page.locator("[data-testid='task-card']")).toHaveCount(0);
    expect(await readPendingMarker(page)).toBeNull();
    expect(await countStoredTasks(page)).toBe(0);
  });
});
