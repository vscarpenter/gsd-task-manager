import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

test.describe("Settings storage summary counts Trash", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix.
  });

  test("a deleted task still counts in the total and shows in the breakdown", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Keep this one !!");
    await matrix.createTask("Delete this one");
    const card = page.getByTestId("task-card").filter({ hasText: "Delete this one" });
    await card.hover();
    await card.getByRole("button", { name: "Delete task" }).click();
    await expect(page.getByTestId("task-card").filter({ hasText: "Delete this one" })).toHaveCount(0);

    await page.goto("/settings#data", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("2 tasks")).toBeVisible();
    await expect(page.getByText("Trash:")).toBeVisible();
  });
});
