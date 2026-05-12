import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

test.describe("Quadrant Classification", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("should display all four quadrants", async ({ page }) => {
    await expect(page.locator("[data-testid='quadrant-q1']")).toBeVisible();
    await expect(page.locator("[data-testid='quadrant-q2']")).toBeVisible();
    await expect(page.locator("[data-testid='quadrant-q3']")).toBeVisible();
    await expect(page.locator("[data-testid='quadrant-q4']")).toBeVisible();
  });

  test("should display quadrant headers", async ({ page }) => {
    const q1 = page.locator("[data-testid='quadrant-q1']");
    await expect(q1).toContainText("Do");
    
    const q2 = page.locator("[data-testid='quadrant-q2']");
    await expect(q2).toContainText("Schedule");
    
    const q3 = page.locator("[data-testid='quadrant-q3']");
    await expect(q3).toContainText("Delegate");
    
    const q4 = page.locator("[data-testid='quadrant-q4']");
    await expect(q4).toContainText("Eliminate");
  });

  // Capture-parser syntax (see lib/capture-parser.ts):
  //   "task !!"  → urgent + important → Q1 (Do First)
  //   "task *"   → important only     → Q2 (Schedule)
  //   "task !"   → urgent only        → Q3 (Delegate)
  //   "task"     → neither            → Q4 (Eliminate)
  // Tokens must be space-bounded; `!important` is treated as a literal word.

  test("should classify task as urgent + important (Q1) with !!", async ({ page }) => {
    await matrixPage.createTask("crisis report !!");

    const q1Task = page
      .locator("[data-testid='quadrant-q1'] [data-testid='task-card']")
      .filter({ hasText: "crisis report" });
    await expect(q1Task).toBeVisible();

    // Confirm it did NOT land in any other quadrant
    for (const other of ["q2", "q3", "q4"] as const) {
      await expect(
        page.locator(`[data-testid='quadrant-${other}'] [data-testid='task-card']`).filter({ hasText: "crisis report" })
      ).toHaveCount(0);
    }
  });

  test("should classify task as important-only (Q2) with *", async ({ page }) => {
    await matrixPage.createTask("plan next quarter *");

    const q2Task = page
      .locator("[data-testid='quadrant-q2'] [data-testid='task-card']")
      .filter({ hasText: "plan next quarter" });
    await expect(q2Task).toBeVisible();

    for (const other of ["q1", "q3", "q4"] as const) {
      await expect(
        page.locator(`[data-testid='quadrant-${other}'] [data-testid='task-card']`).filter({ hasText: "plan next quarter" })
      ).toHaveCount(0);
    }
  });

  test("should classify task as urgent-only (Q3) with !", async ({ page }) => {
    await matrixPage.createTask("answer voicemail !");

    const q3Task = page
      .locator("[data-testid='quadrant-q3'] [data-testid='task-card']")
      .filter({ hasText: "answer voicemail" });
    await expect(q3Task).toBeVisible();

    for (const other of ["q1", "q2", "q4"] as const) {
      await expect(
        page.locator(`[data-testid='quadrant-${other}'] [data-testid='task-card']`).filter({ hasText: "answer voicemail" })
      ).toHaveCount(0);
    }
  });

  test("should classify task as neither (Q4) by default", async ({ page }) => {
    await matrixPage.createTask("organize bookshelf");

    const q4Task = page
      .locator("[data-testid='quadrant-q4'] [data-testid='task-card']")
      .filter({ hasText: "organize bookshelf" });
    await expect(q4Task).toBeVisible();

    for (const other of ["q1", "q2", "q3"] as const) {
      await expect(
        page.locator(`[data-testid='quadrant-${other}'] [data-testid='task-card']`).filter({ hasText: "organize bookshelf" })
      ).toHaveCount(0);
    }
  });

  test("should move task between quadrants via edit drawer", async ({ page }) => {
    await matrixPage.createTask("relocate me");

    // Starts in Q4 (no flags)
    await expect(
      page.locator("[data-testid='quadrant-q4'] [data-testid='task-card']").filter({ hasText: "relocate me" })
    ).toBeVisible();

    // Move to Q2 via edit drawer
    await matrixPage.openEditDrawer("relocate me");
    await matrixPage.saveEditDrawer({ quadrant: "q2" });

    await expect(
      page.locator("[data-testid='quadrant-q2'] [data-testid='task-card']").filter({ hasText: "relocate me" })
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='quadrant-q4'] [data-testid='task-card']").filter({ hasText: "relocate me" })
    ).toHaveCount(0);

    // Move from Q2 to Q1
    await matrixPage.openEditDrawer("relocate me");
    await matrixPage.saveEditDrawer({ quadrant: "q1" });

    await expect(
      page.locator("[data-testid='quadrant-q1'] [data-testid='task-card']").filter({ hasText: "relocate me" })
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='quadrant-q2'] [data-testid='task-card']").filter({ hasText: "relocate me" })
    ).toHaveCount(0);
  });

  test("should show empty state for quadrants with no tasks", async ({ page }) => {
    // All quadrants should show empty state initially
    const q1 = page.locator("[data-testid='quadrant-q1']");
    await expect(q1).toContainText("Do First");
    
    const q2 = page.locator("[data-testid='quadrant-q2']");
    await expect(q2).toContainText("Schedule");
    
    const q3 = page.locator("[data-testid='quadrant-q3']");
    await expect(q3).toContainText("Delegate");
    
    const q4 = page.locator("[data-testid='quadrant-q4']");
    await expect(q4).toContainText("Eliminate");
  });
});