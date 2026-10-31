import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

test.describe("Editor snooze", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix, not /about.
  });

  test("snoozes from the editor on Save, shows it on reopen, and clears it", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Call the plumber *");
    const card = page.getByTestId("task-card").filter({ hasText: "Call the plumber" });

    await card.hover();
    await card.getByRole("button", { name: "Edit task" }).click();
    await expect(page.getByRole("group", { name: "Snooze" })).toContainText("Not snoozed");
    await page.getByRole("button", { name: "Snooze tomorrow" }).click();
    await expect(page.getByRole("group", { name: "Snooze" })).toContainText("Snoozed until");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(card.getByTestId("task-card-snoozed-chip")).toBeVisible();

    await card.hover();
    await card.getByRole("button", { name: "Edit task" }).click();
    await expect(page.getByRole("group", { name: "Snooze" })).toContainText("Snoozed until");
    await page.getByRole("button", { name: "Clear snooze" }).click();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(card.getByTestId("task-card-snoozed-chip")).toHaveCount(0);
  });

  test("Cancel leaves the snooze untouched", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Water the plants *");
    const card = page.getByTestId("task-card").filter({ hasText: "Water the plants" });
    await card.hover();
    await card.getByRole("button", { name: "Edit task" }).click();
    await page.getByRole("button", { name: "Snooze 1 hour" }).click();
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(card.getByTestId("task-card-snoozed-chip")).toHaveCount(0);
  });
});
