import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Data & Storage flows: export, import (valid + malformed), import dialog
 * lifecycle, and the error toasts users see when something goes wrong.
 *
 * Export-download is already covered by settings-navigation.spec.ts, so the
 * focus here is the import side plus error states.
 */

async function gotoDataSection(matrixPage: MatrixPage): Promise<void> {
  await matrixPage.openSettings();
  await matrixPage.page
    .locator("aside.lg\\:block")
    .getByRole("button", { name: "Data & Storage" })
    .click();
  await expect(matrixPage.page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();
}

test.describe("Data Management — Import", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("invalid JSON import surfaces a toast and does not open the import dialog", async ({ page }) => {
    await gotoDataSection(matrixPage);

    // Find the hidden <input type="file"> the click handler creates by listening
    // for filechooser events. The Import button creates the input on demand.
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /import/i }).click();
    const fileChooser = await fileChooserPromise;

    // Feed it a malformed JSON buffer
    await fileChooser.setFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{this is not valid json"),
    });

    // Sonner toast should surface the error
    await expect(page.getByText(/invalid json format/i)).toBeVisible({ timeout: 5000 });

    // The import confirm dialog must NOT have opened
    await expect(page.getByRole("dialog", { name: /import tasks/i })).toHaveCount(0);
  });

  test("valid JSON import opens the confirmation dialog with task count", async ({ page }) => {
    await gotoDataSection(matrixPage);

    const validPayload = JSON.stringify({
      version: "1.0.0",
      exportedAt: "2026-01-01T00:00:00.000Z",
      tasks: [
        {
          id: "task-1",
          title: "Imported task one",
          description: "",
          urgent: false,
          important: true,
          quadrant: "not-urgent-important",
          completed: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: false,
          notificationSent: false,
        },
        {
          id: "task-2",
          title: "Imported task two",
          description: "",
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          completed: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: false,
          notificationSent: false,
        },
      ],
    });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /import/i }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: "valid.json",
      mimeType: "application/json",
      buffer: Buffer.from(validPayload),
    });

    // Import confirmation dialog should open with a task count of 2
    const dialog = page.getByRole("dialog", { name: /import tasks/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toContainText(/2 tasks/i);
  });

  test("complete JSON import flow merges tasks into the matrix", async ({ page }) => {
    await matrixPage.createTask("Existing task");
    await gotoDataSection(matrixPage);

    const validPayload = JSON.stringify({
      version: "1.0.0",
      exportedAt: "2026-01-01T00:00:00.000Z",
      tasks: [
        {
          id: "task-1",
          title: "Imported task one",
          description: "",
          urgent: false,
          important: true,
          quadrant: "not-urgent-important",
          completed: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: false,
          notificationSent: false,
        },
        {
          id: "task-2",
          title: "Imported task two",
          description: "",
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          completed: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: false,
          notificationSent: false,
        },
      ],
    });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /import/i }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: "complete-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(validPayload),
    });

    const dialog = page.getByRole("dialog", { name: /import tasks/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole("button", { name: /merge tasks/i }).click();
    await expect(dialog).toBeHidden();

    await matrixPage.openMatrix();
    await expect(page.locator("[data-testid='task-card']")).toHaveCount(3);
    await expect(page.getByText("Existing task")).toBeVisible();
    await expect(page.getByText("Imported task one")).toBeVisible();
    await expect(page.getByText("Imported task two")).toBeVisible();
  });

  test("import dialog cancel button closes the dialog without changes", async ({ page }) => {
    await gotoDataSection(matrixPage);

    const payload = JSON.stringify({
      version: "1.0.0",
      exportedAt: "2026-01-01T00:00:00.000Z",
      tasks: [],
    });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /import/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "empty.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload),
    });

    const dialog = page.getByRole("dialog", { name: /import tasks/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("Data section shows the current task count", async ({ page }) => {
    await matrixPage.createTask("First task to count");
    await matrixPage.createTask("Second task to count");

    await gotoDataSection(matrixPage);

    // The DataManagement section renders an active-task count.
    // Use the inner content <main> (the settings layout nests two mains).
    await expect(page.locator("main.min-w-0")).toContainText(/2/);
  });
});
