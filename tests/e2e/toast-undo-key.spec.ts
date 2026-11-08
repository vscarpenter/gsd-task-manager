import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

interface SeedTask {
  id: string;
  title: string;
  urgent: boolean;
  important: boolean;
  quadrant: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
}

/** Seeds tasks straight into IndexedDB after the app has opened the DB. */
async function seedTasks(page: Page, tasks: SeedTask[]): Promise<void> {
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("GsdTaskManager");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("tasks", "readwrite");
          for (const row of rows) {
            tx.objectStore("tasks").add({
              description: "", completed: false, recurrence: "none", tags: [], subtasks: [], dependencies: [],
              notificationEnabled: false, notificationSent: false, timeSpent: 0, timeEntries: [], ...row,
            });
          }
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      }),
    tasks
  );
}


const OVERDUE: SeedTask = {
  id: "toast-overdue", title: "Send the invoice", urgent: false, important: false, quadrant: "not-urgent-not-important",
  createdAt: daysAgo(10), updatedAt: daysAgo(1), dueDate: daysAgo(3),
};
const STALE_Q4: SeedTask = {
  id: "toast-stale", title: "Sort the old photos", urgent: false, important: false, quadrant: "not-urgent-not-important",
  createdAt: daysAgo(60), updatedAt: daysAgo(30),
};

/** Reads a stored task's `completed` flag straight from IndexedDB. */
async function storedCompleted(page: Page, id: string): Promise<boolean | undefined> {
  return page.evaluate(
    (taskId) =>
      new Promise<boolean | undefined>((resolve, reject) => {
        const open = indexedDB.open("GsdTaskManager");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction("tasks").objectStore("tasks").get(taskId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => { open.result.close(); resolve(get.result?.completed); };
        };
      }),
    id
  );
}

/** The Sonner hotkey (Alt+T) focuses the toast list; two Tabs then reach Undo. */
async function reachUndoByKeyboard(page: Page): Promise<void> {
  await expect(page.getByText("Press Alt+T, then Tab twice, to reach Undo.")).toBeAttached();
  await page.keyboard.press("Alt+KeyT");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
}

test.describe("Undo toast by keyboard", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Requesting the fixture seeds the launch flag and clears IndexedDB.
  });

  test("sweep: Alt+T then Tab reaches Undo and restores the task", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);
    await seedTasks(page, [STALE_Q4, OVERDUE]);
    await page.reload();
    await waitForAppLoad(page);
    await page.goto("/dashboard/");
    await page.getByRole("link", { name: "Start weekly sweep" }).click();
    await expect(page.getByRole("article", { name: "Send the invoice" })).toBeVisible();

    await page.getByRole("button", { name: "Complete" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("article", { name: "Sort the old photos" })).toBeVisible();
    await reachUndoByKeyboard(page);
    await page.keyboard.press("Enter");
    // The sweep session moves on, so the proof is the task being open again.
    await expect.poll(() => storedCompleted(page, "toast-overdue")).toBe(false);
    await page.goto("/");
    await waitForAppLoad(page);
    await expect(page.getByText("Send the invoice")).toBeVisible();
  });

  test("matrix: Alt+T then Tab reaches Undo and restores the task", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);
    await seedTasks(page, [STALE_Q4]);
    await page.reload();
    await waitForAppLoad(page);

    await page.getByRole("button", { name: "Mark as complete" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Sort the old photos")).toBeHidden();
    await reachUndoByKeyboard(page);
    await page.keyboard.press("Enter");
    await expect(page.getByText("Sort the old photos")).toBeVisible();
    // The card that had focus is gone, so focus goes to the page's main region, not <body>.
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("matrix: focus returns to the element that had it before Alt+T", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);
    await seedTasks(page, [STALE_Q4]);
    await page.reload();
    await waitForAppLoad(page);

    await page.getByRole("button", { name: "Mark as complete" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Sort the old photos")).toBeHidden();
    await page.keyboard.press("n");
    const capture = page.getByRole("textbox", { name: "Add a task" });
    await expect(capture).toBeFocused();
    await reachUndoByKeyboard(page);
    await page.keyboard.press("Enter");
    await expect(page.getByText("Sort the old photos")).toBeVisible();
    await expect(capture).toBeFocused();
  });
});
