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
  id: "sweep-overdue", title: "Send the invoice", urgent: false, important: false, quadrant: "not-urgent-not-important",
  createdAt: daysAgo(10), updatedAt: daysAgo(1), dueDate: daysAgo(3),
};
const STALE_Q4: SeedTask = {
  id: "sweep-stale", title: "Sort the old photos", urgent: false, important: false, quadrant: "not-urgent-not-important",
  createdAt: daysAgo(60), updatedAt: daysAgo(30),
};
const UNDATED: SeedTask = {
  id: "sweep-undated", title: "Plan the offsite", urgent: false, important: true, quadrant: "not-urgent-important",
  createdAt: daysAgo(5), updatedAt: daysAgo(2),
};

test.describe("Weekly sweep", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix.
  });

  test("sweeps overdue, stale, then undated Schedule; skip leaves a task unchanged", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);
    await seedTasks(page, [UNDATED, STALE_Q4, OVERDUE]);
    await page.reload();
    await waitForAppLoad(page);

    await page.getByRole("link", { name: "Weekly sweep" }).click();
    await expect(page).toHaveURL(/\/sweep\/?$/);
    await expect(page.getByRole("article", { name: "Send the invoice" })).toBeVisible();
    await expect(page.getByText("Due date passed")).toBeVisible();
    await expect(page.getByRole("status").first()).toHaveText("1 of 3");

    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByRole("article", { name: "Sort the old photos" })).toBeVisible();
    await expect(page.getByText("No changes in 14 days or more")).toBeVisible();
    await expect(page.getByRole("status").first()).toHaveText("2 of 3");

    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("article", { name: "Plan the offsite" })).toBeVisible();
    await expect(page.getByText("No date yet")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();

    await expect(page.getByRole("heading", { name: "That's the sweep." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pick today's top three" })).toBeVisible();

    const rows = await page.evaluate(
      () =>
        new Promise<Record<string, { completed: boolean; updatedAt: string }>>((resolve) => {
          const req = indexedDB.open("GsdTaskManager");
          req.onsuccess = () => {
            const all = req.result.transaction("tasks").objectStore("tasks").getAll();
            all.onsuccess = () =>
              resolve(Object.fromEntries(all.result.map((t: { id: string; completed: boolean; updatedAt: string }) => [t.id, t])));
          };
        })
    );
    expect(rows["sweep-overdue"].completed).toBe(true);
    expect(rows["sweep-stale"].updatedAt).toBe(STALE_Q4.updatedAt);
    expect(rows["sweep-undated"].updatedAt).toBe(UNDATED.updatedAt);
  });

  test("the entry line goes away after a finished sweep", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);
    await seedTasks(page, [STALE_Q4]);
    await page.reload();
    await waitForAppLoad(page);

    await page.getByRole("link", { name: "Weekly sweep" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page).toHaveURL(/\/$/);

    await expect(page.getByRole("link", { name: "Weekly sweep" })).toHaveCount(0);
  });

  test("the Review page links to the sweep even with no tasks", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Start weekly sweep" })).toHaveAttribute("href", /\/sweep\/?$/);
  });
});
