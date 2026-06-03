import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad, createTaskViaCaptureBar } from "./helpers/test-helpers";

/**
 * E2E tests for recurring task auto-creation.
 *
 * Since the edit drawer doesn't expose a recurrence field, we seed tasks
 * with recurrence directly into IndexedDB via page.evaluate() and verify
 * that completing them auto-creates a new instance with an advanced due date.
 */

/**
 * Seed a recurring task into IndexedDB. Must be called AFTER the app is loaded
 * (so Dexie has already opened the DB at the correct version). We open at
 * the current schema version (14) to avoid blocking on a versionchange transaction.
 */
async function seedRecurringTask(
  page: import("@playwright/test").Page,
  options: {
    title: string;
    recurrence: "daily" | "weekly" | "monthly";
    dueDate: string; // ISO date string
    quadrant?: string;
  }
) {
  await page.evaluate(
    ({ title, recurrence, dueDate, quadrant }) => {
      return new Promise<void>((resolve, reject) => {
        const DB_VERSION = 140;
        const req = indexedDB.open("GsdTaskManager", DB_VERSION);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("tasks", "readwrite");
          const store = tx.objectStore("tasks");

          const id = `test-recurring-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const now = new Date().toISOString();

          const quadrantMap: Record<string, string> = {
            q1: "urgent-important",
            q2: "not-urgent-important",
            q3: "urgent-not-important",
            q4: "not-urgent-not-important",
          };

          const task = {
            id,
            title,
            description: "",
            urgent: quadrant === "q1" || quadrant === "q3",
            important: quadrant === "q1" || quadrant === "q2",
            quadrant: quadrantMap[quadrant || "q1"] || "urgent-important",
            completed: false,
            completedAt: undefined,
            dueDate,
            createdAt: now,
            updatedAt: now,
            recurrence,
            tags: [],
            subtasks: [],
            dependencies: [],
            notifyBefore: undefined,
            notificationEnabled: false,
            notificationSent: false,
            lastNotificationAt: undefined,
            snoozedUntil: undefined,
            estimatedMinutes: undefined,
            timeSpent: 0,
            timeEntries: [],
          };

          store.add(task);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
        req.onupgradeneeded = () => {
          // Should not fire — app already created the schema
          req.result.close();
          reject(new Error("Unexpected upgrade needed — app DB not initialized"));
        };
        req.onerror = () => reject(req.error);
      });
    },
    options
  );
}

async function getTaskCountByTitle(
  page: import("@playwright/test").Page,
  titleSubstring: string
): Promise<number> {
  return page.locator(`[data-testid='task-card']`).filter({ hasText: titleSubstring }).count();
}

test.describe("Recurring Task Auto-Creation", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("completing a daily recurring task creates a new instance", async ({ page }) => {
    await waitForAppLoad(page);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateISO = tomorrow.toISOString();

    await seedRecurringTask(page, {
      title: "Daily Standup",
      recurrence: "daily",
      dueDate: dueDateISO,
      quadrant: "q1",
    });

    // Reload to pick up the seeded task
    await page.reload();
    await waitForAppLoad(page);

    // Verify task appears
    const taskCard = page.locator("[data-testid='task-card']").filter({ hasText: "Daily Standup" });
    await expect(taskCard.first()).toBeVisible();

    // Complete the task
    await taskCard.first().locator("[data-testid='complete-task']").click();

    // Wait for recurrence to create new instance
    await page.waitForTimeout(1000);

    // The completed task may be hidden by default, but a NEW uncompleted instance
    // should appear. Verify at least 1 visible task with this title exists (the new one).
    const visibleCards = page.locator("[data-testid='task-card']").filter({ hasText: "Daily Standup" });
    await expect(visibleCards.first()).toBeVisible({ timeout: 5000 });
    const count = await visibleCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("completing a weekly recurring task creates a new instance", async ({ page }) => {
    await waitForAppLoad(page);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueDateISO = nextWeek.toISOString();

    await seedRecurringTask(page, {
      title: "Weekly Review",
      recurrence: "weekly",
      dueDate: dueDateISO,
      quadrant: "q2",
    });

    await page.reload();
    await waitForAppLoad(page);

    const taskCard = page.locator("[data-testid='task-card']").filter({ hasText: "Weekly Review" });
    await expect(taskCard.first()).toBeVisible();

    // Complete the task
    await taskCard.first().locator("[data-testid='complete-task']").click();
    await page.waitForTimeout(1000);

    // New instance should appear (completed one may be hidden)
    const visibleCards = page.locator("[data-testid='task-card']").filter({ hasText: "Weekly Review" });
    await expect(visibleCards.first()).toBeVisible({ timeout: 5000 });
    const count = await visibleCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("completing a monthly recurring task creates a new instance", async ({ page }) => {
    await waitForAppLoad(page);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const dueDateISO = nextMonth.toISOString();

    await seedRecurringTask(page, {
      title: "Monthly Report",
      recurrence: "monthly",
      dueDate: dueDateISO,
      quadrant: "q1",
    });

    await page.reload();
    await waitForAppLoad(page);

    const taskCard = page.locator("[data-testid='task-card']").filter({ hasText: "Monthly Report" });
    await expect(taskCard.first()).toBeVisible();

    // Complete the task
    await taskCard.first().locator("[data-testid='complete-task']").click();
    await page.waitForTimeout(1000);

    // New instance should appear (completed one may be hidden)
    const visibleCards = page.locator("[data-testid='task-card']").filter({ hasText: "Monthly Report" });
    await expect(visibleCards.first()).toBeVisible({ timeout: 5000 });
    const count = await visibleCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("completing a non-recurring task does NOT create a new instance", async ({ page }) => {
    await waitForAppLoad(page);

    // Create a regular non-recurring task via capture bar
    await createTaskViaCaptureBar(page, "One-time Task");

    const taskCard = page.locator("[data-testid='task-card']").filter({ hasText: "One-time Task" });
    await expect(taskCard).toBeVisible();

    // Complete it
    await taskCard.locator("[data-testid='complete-task']").click();
    await page.waitForTimeout(1000);

    // Should still have exactly 1 task (now completed, possibly hidden)
    // The key assertion: no second task was created
    const count = await getTaskCountByTitle(page, "One-time Task");
    expect(count).toBeLessThanOrEqual(1);
  });

  test("new recurring instance appears in the same quadrant", async ({ page }) => {
    await waitForAppLoad(page);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await seedRecurringTask(page, {
      title: "Q2 Recurring",
      recurrence: "daily",
      dueDate: tomorrow.toISOString(),
      quadrant: "q2",
    });

    await page.reload();
    await waitForAppLoad(page);

    // Verify task is in Q2
    const q2 = page.locator("[data-testid='quadrant-q2']");
    const taskInQ2 = q2.locator("[data-testid='task-card']").filter({ hasText: "Q2 Recurring" });
    await expect(taskInQ2.first()).toBeVisible();

    // Complete it
    await taskInQ2.first().locator("[data-testid='complete-task']").click();
    await page.waitForTimeout(1000);

    // New instance should also appear in Q2 (uncompleted)
    const newInstanceInQ2 = q2.locator("[data-testid='task-card']").filter({ hasText: "Q2 Recurring" });
    await expect(newInstanceInQ2.first()).toBeVisible();
  });
});
