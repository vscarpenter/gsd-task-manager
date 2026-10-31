import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/** Seeds a task straight into IndexedDB after the app has opened the DB. */
async function seedTask(
  page: import("@playwright/test").Page,
  task: { title: string; urgent: boolean; important: boolean; quadrant: string; dueDate: string }
) {
  await page.evaluate(
    (t) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("GsdTaskManager");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("tasks", "readwrite");
          const now = new Date().toISOString();
          tx.objectStore("tasks").add({
            id: `test-escalation-${Math.random().toString(36).slice(2, 8)}`,
            description: "",
            completed: false,
            createdAt: now,
            updatedAt: now,
            recurrence: "none",
            tags: [],
            subtasks: [],
            dependencies: [],
            notificationEnabled: false,
            notificationSent: false,
            timeSpent: 0,
            timeEntries: [],
            ...t,
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      }),
    task
  );
}

function tomorrowNoon(): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

test.describe("Escalation by due date", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix, not /about.
  });

  test("tags a Schedule task due tomorrow, and Mark urgent moves it to Do First", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await seedTask(page, {
      title: "File the quarterly report",
      urgent: false,
      important: true,
      quadrant: "not-urgent-important",
      dueDate: tomorrowNoon(),
    });
    await page.reload();
    await waitForAppLoad(page);

    const card = page.getByTestId("quadrant-q2").getByTestId("task-card").filter({ hasText: "File the quarterly report" });
    await expect(card.getByRole("img", { name: "Escalating: due tomorrow, not marked urgent." })).toBeVisible();

    await card.hover();
    await card.getByRole("button", { name: "Mark urgent, moves to Do First" }).click();

    const moved = page.getByTestId("quadrant-q1").getByTestId("task-card").filter({ hasText: "File the quarterly report" });
    await expect(moved).toBeVisible();
    await expect(moved.getByTestId("task-card-escalating-tag")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  });

  test("the editor explains the nudge and drops it once an urgent quadrant is chosen", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await seedTask(page, {
      title: "Book the venue",
      urgent: false,
      important: true,
      quadrant: "not-urgent-important",
      dueDate: tomorrowNoon(),
    });
    await page.reload();
    await waitForAppLoad(page);

    const card = page.getByTestId("quadrant-q2").getByTestId("task-card").filter({ hasText: "Book the venue" });
    await card.hover();
    await card.getByRole("button", { name: "Edit task" }).click();
    const hint = page.getByTestId("edit-escalation-hint");
    await expect(hint).toHaveText("Moves to Do First");

    await page.getByTestId("edit-quadrant-q1").click();
    await expect(hint).toHaveCount(0);
  });

  test("Off in Settings removes every tag", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await seedTask(page, {
      title: "Renew the passport",
      urgent: false,
      important: false,
      quadrant: "not-urgent-not-important",
      dueDate: tomorrowNoon(),
    });
    await page.reload();
    await waitForAppLoad(page);
    await expect(page.getByTestId("task-card-escalating-tag")).toHaveCount(1);

    await page.evaluate(() => localStorage.setItem("gsd:escalation-window", "off"));
    await page.reload();
    await waitForAppLoad(page);
    await expect(page.getByTestId("task-card")).toHaveCount(1);
    await expect(page.getByTestId("task-card-escalating-tag")).toHaveCount(0);
  });
});
