import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

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