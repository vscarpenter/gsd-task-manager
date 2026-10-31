import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

test.describe("Card menu: Duplicate and Move to", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix, not /about.
  });

  test("Duplicate adds a copy beside the original", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Draft the agenda *");
    const card = page.getByTestId("task-card").filter({ hasText: "Draft the agenda" });
    await card.hover();
    await card.getByRole("button", { name: "Duplicate task" }).click();
    await expect(page.getByTestId("task-card").filter({ hasText: "Draft the agenda (Copy)" })).toHaveCount(1);
    await expect(page.getByTestId("quadrant-q2").getByTestId("task-card")).toHaveCount(2);
  });

  test("Move to sends a card to another quadrant and Undo brings it back", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Plan the offsite *");
    const card = page.getByTestId("quadrant-q2").getByTestId("task-card").filter({ hasText: "Plan the offsite" });
    await card.hover();
    await card.getByRole("button", { name: "More actions" }).click();
    // Keyboard path: a pointer teleported onto a Radix submenu item races its popper positioning.
    await page.getByRole("menuitem", { name: "Move to", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menuitem", { name: "Do First" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("quadrant-q1").getByTestId("task-card").filter({ hasText: "Plan the offsite" })).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByTestId("quadrant-q2").getByTestId("task-card").filter({ hasText: "Plan the offsite" })).toBeVisible();
  });
});

test.describe("Card menu: Snooze presets", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix, not /about.
  });

  test("a mouse user can snooze for a preset and clear it", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Call the plumber *");
    const card = page.getByTestId("task-card").filter({ hasText: "Call the plumber" });
    await card.hover();
    await card.getByRole("button", { name: "More actions" }).click();
    // Keyboard path: a pointer teleported onto a Radix submenu item races its popper positioning.
    await page.getByRole("menuitem", { name: "Snooze", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("menuitem", { name: "Tomorrow" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Snoozed for 1 day")).toBeVisible();
    await expect(card.getByTestId("task-card-snoozed-chip")).toBeVisible();

    await card.hover();
    await card.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Snooze", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("menuitem", { name: "Clear snooze" }).focus();
    await page.keyboard.press("Enter");
    await expect(card.getByTestId("task-card-snoozed-chip")).toHaveCount(0);
  });
});
