import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad, createTaskViaCaptureBar } from "./helpers/test-helpers";

test.describe("Task CRUD Operations", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("should create a new task via capture bar", async ({ page }) => {
    const initialCount = await matrixPage.getTaskCount();
    await matrixPage.createTask("Test task for e2e");
    
    const newCount = await matrixPage.getTaskCount();
    expect(newCount).toBe(initialCount + 1);
    
    // Verify the task appears in the matrix
    const taskCard = page.locator("[data-testid='task-card']").filter({ hasText: "Test task for e2e" });
    await expect(taskCard).toBeVisible();
  });

  test("should read and display task details", async ({ page }) => {
    await matrixPage.createTask("Task to read");
    
    const taskCard = page.locator("[data-testid='task-card']").filter({ hasText: "Task to read" });
    await expect(taskCard).toBeVisible();
    
    // Verify task title is displayed
    await expect(taskCard).toContainText("Task to read");
  });

  test("should complete a task", async ({ page }) => {
    await matrixPage.createTask("Task to complete");
    
    const initialCount = await matrixPage.getTaskCount();
    
    await matrixPage.completeTask("Task to complete");
    
    // By default, completed tasks are hidden, so count should decrease
    const newCount = await matrixPage.getTaskCount();
    expect(newCount).toBe(initialCount - 1);
  });

  test("should update task title, description, and quadrant", async ({ page }) => {
    await matrixPage.createTask("Original title");

    // Task defaults to Q4 (not urgent, not important) since no flags were set
    await expect(
      page.locator("[data-testid='quadrant-q4'] [data-testid='task-card']").filter({ hasText: "Original title" })
    ).toBeVisible();

    await matrixPage.openEditDrawer("Original title");
    await matrixPage.saveEditDrawer({
      title: "Updated title",
      description: "Now with details",
      quadrant: "q1",
    });

    // Updated card now lives in Q1 with the new title and description
    const updatedCard = page
      .locator("[data-testid='quadrant-q1'] [data-testid='task-card']")
      .filter({ hasText: "Updated title" });
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard).toContainText("Now with details");

    // Original title is gone everywhere
    await expect(
      page.locator("[data-testid='task-card']").filter({ hasText: "Original title" })
    ).toHaveCount(0);
  });

  test("should delete a task", async ({ page }) => {
    await matrixPage.createTask("Task to delete");
    
    const initialCount = await matrixPage.getTaskCount();
    expect(initialCount).toBeGreaterThan(0);
    
    await matrixPage.deleteTask("Task to delete");
    
    const newCount = await matrixPage.getTaskCount();
    expect(newCount).toBe(initialCount - 1);
    
    // Verify the task is no longer visible
    const taskCard = page.locator("[data-testid='task-card']").filter({ hasText: "Task to delete" });
    await expect(taskCard).not.toBeVisible();
  });

  test("should create multiple tasks", async ({ page }) => {
    const initialCount = await matrixPage.getTaskCount();
    
    await matrixPage.createTask("First task");
    await matrixPage.createTask("Second task");
    await matrixPage.createTask("Third task");
    
    const newCount = await matrixPage.getTaskCount();
    expect(newCount).toBe(initialCount + 3);
    
    // Verify all tasks are visible
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "First task" })).toBeVisible();
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Second task" })).toBeVisible();
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Third task" })).toBeVisible();
  });
});

test.describe("Completed tasks stay collapsed", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  /**
   * Show-completed used to inject every finished card inline, growing the board
   * past 8,000px and pushing active work off screen. The cards are still
   * reachable — one click — they just no longer bury the quadrant's point.
   */
  test("show-completed reveals a disclosure, not a wall of cards", async ({ page }) => {
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, "Finish me !!");
    await createTaskViaCaptureBar(page, "Still open !!");

    const q1 = page.locator("[data-testid='quadrant-q1']");
    const target = q1.locator("[data-testid='task-card']").filter({ hasText: "Finish me" });
    await target.getByRole("button", { name: /mark as complete/i }).click();

    await page.evaluate(() => localStorage.setItem("gsd:show-completed", "true"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);

    const disclosure = q1.getByRole("button", { name: /1 done/i });
    await expect(disclosure).toBeVisible();
    await expect(q1.locator("[data-testid='task-card']").filter({ hasText: "Finish me" })).toHaveCount(0);
    await expect(q1.locator("[data-testid='task-card']").filter({ hasText: "Still open" })).toBeVisible();

    await disclosure.click();
    await expect(q1.locator("[data-testid='task-card']").filter({ hasText: "Finish me" })).toBeVisible();
  });
});
