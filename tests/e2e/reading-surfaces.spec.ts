import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, waitForAppLoad } from "./helpers/test-helpers";
import type { SyncHistoryRecord } from "../../lib/types";

test("the server-rendered review fits a narrow phone before hydration", async ({ baseURL, browser }) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 720 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/dashboard/");
    await expect(page.getByRole("status", { name: "Loading review data" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  } finally {
    await context.close();
  }
});

function seedSyncHistory(page: Page, records: SyncHistoryRecord[]) {
  return page.evaluate((rows) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("GsdTaskManager");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("syncHistory", "readwrite");
      const history = transaction.objectStore("syncHistory");
      rows.forEach((record) => history.put(record));
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), records);
}

test("a long sync diagnostic leaves room for the next operation", async ({ page, clearIndexedDB }) => {
  await waitForAppLoad(page);
  await page.setViewportSize({ width: 375, height: 812 });
  const message = "The sync server could not be reached after three retries. ".repeat(6).trim();
  const shared = { pushedCount: 0, pulledCount: 0, conflictsResolved: 0, deviceId: "test", triggeredBy: "user" } as const;
  await seedSyncHistory(page, [
    { ...shared, id: "new-error", timestamp: "2026-11-23T10:00:00Z", status: "error", errorMessage: message },
    { ...shared, id: "old-partial", timestamp: "2026-11-23T09:00:00Z", status: "partial", failedCount: 3 },
  ]);
  await page.goto("/sync-history/");
  const diagnostic = page.getByText(message);
  await expect(diagnostic).toBeVisible();
  const nextOperation = page.getByRole("heading", { name: /partial sync/i });
  await expect(nextOperation).toBeVisible();
  const lastLine = (await diagnostic.boundingBox())!;
  expect((await nextOperation.boundingBox())!.y).toBeGreaterThan(lastLine.y + lastLine.height);
  await expect(page.getByText("3 failed", { exact: true })).toBeVisible();
});

test("archived tasks offer visible restore controls without live-task buttons", async ({ page, clearIndexedDB }) => {
  await waitForAppLoad(page);
  await createTaskViaCaptureBar(page, "A task that has been archived");
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("GsdTaskManager");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(["tasks", "archivedTasks"], "readwrite");
      const tasks = transaction.objectStore("tasks");
      const read = tasks.getAll();
      read.onsuccess = () => {
        const task = read.result[0];
        const now = new Date().toISOString();
        transaction.objectStore("archivedTasks").put({ ...task, completed: true, completedAt: now, archivedAt: now });
        tasks.delete(task.id);
      };
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/archive/");
  const restore = page.getByRole("button", { name: "Restore", exact: true });
  await expect(restore).toBeVisible();
  await expect(restore).toHaveAccessibleDescription("A task that has been archived");
  expect(await restore.evaluate((button) => {
    for (let element: Element | null = button; element; element = element.parentElement) {
      if (getComputedStyle(element).opacity === "0") return false;
    }
    return true;
  })).toBe(true);
  await expect(page.getByRole("button", { name: "Mark as incomplete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit task" })).toHaveCount(0);
  await restore.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No archived tasks")).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A task that has been archived", exact: true })).toBeVisible();
});
