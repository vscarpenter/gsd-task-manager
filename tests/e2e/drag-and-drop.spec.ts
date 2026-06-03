import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad, createTaskViaCaptureBar } from "./helpers/test-helpers";
import type { Page, Locator } from "@playwright/test";

/**
 * E2E tests for drag-and-drop between quadrants.
 *
 * Uses manual mouse events to simulate drag because @dnd-kit requires
 * pointer movement past an 8px activation distance before initiating drag.
 */

/**
 * Perform a drag from a source handle to a target container using manual mouse events.
 * This works with @dnd-kit's PointerSensor activation constraint.
 */
async function performDrag(page: Page, source: Locator, target: Locator) {
  await source.hover();
  const handleBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!handleBox || !targetBox) {
    throw new Error("Could not get bounding boxes for drag source/target");
  }

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move past the 8px activation distance
  await page.mouse.move(startX, startY - 10, { steps: 3 });
  await page.waitForTimeout(100);
  // Move to target center
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(1000);
}

test.describe("Drag and Drop Between Quadrants", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("drag task from Q4 to Q1 updates quadrant", async ({ page }) => {
    await waitForAppLoad(page);

    // Create a task — defaults to Q4 (not urgent, not important) via capture bar
    await createTaskViaCaptureBar(page, "Move to Q1");
    await page.waitForTimeout(500);

    // Verify it's in Q4
    const q4 = page.locator("[data-testid='quadrant-q4']");
    const taskInQ4 = q4.locator("[data-testid='task-card']").filter({ hasText: "Move to Q1" });
    await expect(taskInQ4).toBeVisible();

    // Drag the task to Q1
    const dragHandle = taskInQ4.locator("button[aria-label='Drag to move task']");
    const q1 = page.locator("[data-testid='quadrant-q1']");
    await performDrag(page, dragHandle, q1);

    // Verify task moved to Q1
    const taskInQ1 = q1.locator("[data-testid='task-card']").filter({ hasText: "Move to Q1" });
    await expect(taskInQ1).toBeVisible({ timeout: 5000 });

    // Verify task is no longer in Q4
    const remainingInQ4 = q4.locator("[data-testid='task-card']").filter({ hasText: "Move to Q1" });
    await expect(remainingInQ4).toHaveCount(0);
  });

  test("drag task from Q1 to Q3 updates quadrant", async ({ page }) => {
    await waitForAppLoad(page);

    // Seed a task in Q1 via IndexedDB
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("GsdTaskManager", 140);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("tasks", "readwrite");
          const store = tx.objectStore("tasks");
          const now = new Date().toISOString();
          store.add({
            id: `dnd-test-${Date.now()}`,
            title: "Delegate This",
            description: "",
            urgent: true,
            important: true,
            quadrant: "urgent-important",
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
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();
    await waitForAppLoad(page);

    // Verify task is in Q1
    const q1 = page.locator("[data-testid='quadrant-q1']");
    const taskInQ1 = q1.locator("[data-testid='task-card']").filter({ hasText: "Delegate This" });
    await expect(taskInQ1).toBeVisible();

    // Drag to Q3 (urgent, not important)
    const dragHandle = taskInQ1.locator("button[aria-label='Drag to move task']");
    const q3 = page.locator("[data-testid='quadrant-q3']");
    await performDrag(page, dragHandle, q3);

    // Verify task is now in Q3
    const taskInQ3 = q3.locator("[data-testid='task-card']").filter({ hasText: "Delegate This" });
    await expect(taskInQ3).toBeVisible();

    // No longer in Q1
    await expect(taskInQ1).toHaveCount(0);
  });

  test("drag task between Q2 and Q4 updates quadrant", async ({ page }) => {
    await waitForAppLoad(page);

    // Seed a task in Q2
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("GsdTaskManager", 140);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("tasks", "readwrite");
          const store = tx.objectStore("tasks");
          const now = new Date().toISOString();
          store.add({
            id: `dnd-q2-${Date.now()}`,
            title: "Schedule This",
            description: "",
            urgent: false,
            important: true,
            quadrant: "not-urgent-important",
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
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();
    await waitForAppLoad(page);

    const q2 = page.locator("[data-testid='quadrant-q2']");
    const taskInQ2 = q2.locator("[data-testid='task-card']").filter({ hasText: "Schedule This" });
    await expect(taskInQ2).toBeVisible();

    // Drag to Q4
    const dragHandle = taskInQ2.locator("button[aria-label='Drag to move task']");
    const q4 = page.locator("[data-testid='quadrant-q4']");
    await performDrag(page, dragHandle, q4);

    // Verify moved to Q4
    const taskInQ4 = q4.locator("[data-testid='task-card']").filter({ hasText: "Schedule This" });
    await expect(taskInQ4).toBeVisible();
    await expect(taskInQ2).toHaveCount(0);
  });

  test("drag preserves task data after quadrant change", async ({ page }) => {
    await waitForAppLoad(page);

    // Seed a task with tags and description in Q1
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("GsdTaskManager", 140);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("tasks", "readwrite");
          const store = tx.objectStore("tasks");
          const now = new Date().toISOString();
          store.add({
            id: `dnd-preserve-${Date.now()}`,
            title: "Preserve My Data",
            description: "Important details here",
            urgent: true,
            important: true,
            quadrant: "urgent-important",
            completed: false,
            createdAt: now,
            updatedAt: now,
            recurrence: "none",
            tags: ["project-x"],
            subtasks: [{ id: "sub1", title: "Sub step", completed: false }],
            dependencies: [],
            notificationEnabled: false,
            notificationSent: false,
            timeSpent: 0,
            timeEntries: [],
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();
    await waitForAppLoad(page);

    const q1 = page.locator("[data-testid='quadrant-q1']");
    const task = q1.locator("[data-testid='task-card']").filter({ hasText: "Preserve My Data" });
    await expect(task).toBeVisible();

    // Drag to Q2
    const dragHandle = task.locator("button[aria-label='Drag to move task']");
    const q2 = page.locator("[data-testid='quadrant-q2']");
    await performDrag(page, dragHandle, q2);

    // Verify task in Q2 still has its title and tag
    const movedTask = q2.locator("[data-testid='task-card']").filter({ hasText: "Preserve My Data" });
    await expect(movedTask).toBeVisible();
    // Tag should still be visible on the card
    await expect(movedTask).toContainText("project-x");
  });
});
