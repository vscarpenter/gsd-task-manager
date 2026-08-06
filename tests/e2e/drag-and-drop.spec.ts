import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad, createTaskViaCaptureBar } from "./helpers/test-helpers";
import type { Page, Locator } from "@playwright/test";

/**
 * E2E tests for drag-and-drop between quadrants.
 *
 * Uses manual mouse events to simulate drag because @dnd-kit requires
 * pointer movement past an 8px activation distance before initiating drag.
 *
 * The IndexedDB seeds below open the store with NO explicit version. Dexie
 * maps `version(N)` in lib/db.ts to IDB version N*10, so a hardcoded number
 * here silently rots on the next schema bump — opening with `undefined` uses
 * whatever version the app just created, which is always the right one.
 */

/**
 * Perform a drag from a source handle to a target container using manual mouse events.
 * This works with @dnd-kit's PointerSensor activation constraint.
 */
async function performDrag(page: Page, source: Locator, target: Locator) {
  const overlay = page.locator("[data-testid='drag-overlay']");
  let lastError: unknown;

  // Browser load can occasionally make the first pointer sequence miss the
  // sensor's activation frame. Retry the actual state transition, not a sleep.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let mouseIsDown = false;
    try {
      await source.scrollIntoViewIfNeeded();
      await source.hover();
      const handleBox = await source.boundingBox();
      if (!handleBox) throw new Error("Could not get a bounding box for the drag source");

      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      mouseIsDown = true;
      await page.mouse.move(startX + 16 + attempt * 8, startY, { steps: 6 });
      await overlay.waitFor({ state: "visible", timeout: 3000 });

      // Re-read the target after activation because dnd-kit can change layout.
      const targetBox = await target.boundingBox();
      if (!targetBox) throw new Error("Could not get a bounding box for the drop target");
      const viewport = page.viewportSize();
      const visibleTop = viewport ? Math.max(targetBox.y + 2, 2) : targetBox.y + 2;
      const visibleBottom = viewport
        ? Math.min(targetBox.y + targetBox.height - 2, viewport.height - 2)
        : targetBox.y + targetBox.height - 2;
      if (visibleTop > visibleBottom) throw new Error("Drop target is outside the viewport");

      const targetPoints = [
        { x: targetBox.x + targetBox.width / 2, y: (visibleTop + visibleBottom) / 2 },
        { x: targetBox.x + targetBox.width - 24, y: visibleBottom },
        { x: targetBox.x + 24, y: visibleBottom },
      ];
      let targetIsActive = false;
      for (const point of targetPoints) {
        await page.mouse.move(point.x, point.y, { steps: 8 });
        try {
          await expect(target).toHaveAttribute("data-drop-active", "true", { timeout: 1500 });
          targetIsActive = true;
          break;
        } catch {
          // Try another visible part of the pane while preserving drag state.
        }
      }
      if (!targetIsActive) throw new Error("Drop target never became active");

      await page.mouse.up();
      mouseIsDown = false;
      await overlay.waitFor({ state: "hidden", timeout: 3000 });
      return;
    } catch (error) {
      lastError = error;
      if (mouseIsDown) await page.mouse.up();
      await overlay.waitFor({ state: "hidden", timeout: 3000 }).catch(() => undefined);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Drag operation failed");
}

async function reloadMatrix(page: Page): Promise<void> {
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("NS_BINDING_ABORTED")) throw error;
    await page.waitForLoadState("domcontentloaded");
  }
  await waitForAppLoad(page);
}

test.describe("Drag and Drop Between Quadrants", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("drag task from Q4 to Q1 updates quadrant", async ({ page }) => {
    await waitForAppLoad(page);

    // Create a task — defaults to Q4 (not urgent, not important) via capture bar
    await createTaskViaCaptureBar(page, "Move to Q1");

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
        const req = indexedDB.open("GsdTaskManager");
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

    await reloadMatrix(page);

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
        const req = indexedDB.open("GsdTaskManager");
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

    await reloadMatrix(page);

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
        const req = indexedDB.open("GsdTaskManager");
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

    await reloadMatrix(page);

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
