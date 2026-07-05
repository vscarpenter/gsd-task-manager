import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

// Dependency linking lived in the v8 task form and was silently lost in the v9
// refactor (#238). This spec defends the restored drawer flow end-to-end:
// link → badges → unlink.
test.describe("Task dependencies (Depends on field)", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("should link tasks in the edit drawer and surface blocked/blocking badges", async ({
    page,
  }) => {
    await matrixPage.createTask("Write report !!");
    await matrixPage.createTask("Gather data *");

    await matrixPage.openEditDrawer("Write report");
    await matrixPage.addDependencyInDrawer("gather", "Gather data");
    await matrixPage.saveEditDrawer({});

    const blockedCard = page
      .locator("[data-testid='task-card']")
      .filter({ hasText: "Write report" });
    const blockingCard = page
      .locator("[data-testid='task-card']")
      .filter({ hasText: "Gather data" });
    await expect(blockedCard.getByText(/blocked by 1/i)).toBeVisible();
    await expect(blockingCard.getByText(/blocking 1/i)).toBeVisible();

    // Unlink: chip is re-hydrated from the persisted record, then removed.
    await matrixPage.openEditDrawer("Write report");
    await matrixPage.removeDependencyInDrawer("Gather data");
    await matrixPage.saveEditDrawer({});

    await expect(blockedCard.getByText(/blocked by 1/i)).toBeHidden();
    await expect(blockingCard.getByText(/blocking 1/i)).toBeHidden();
  });
});
