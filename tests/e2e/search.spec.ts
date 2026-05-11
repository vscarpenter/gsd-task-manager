import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

test.describe("Search Functionality", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("should display search input", async ({ page }) => {
    const searchInput = page.locator("[data-testid='search-input']");
    await expect(searchInput).toBeVisible();
  });

  test("should search tasks by title", async ({ page }) => {
    // Create multiple tasks
    await matrixPage.createTask("Buy groceries");
    await matrixPage.createTask("Complete project report");
    await matrixPage.createTask("Call mom");
    
    await page.waitForTimeout(500);
    
    // Search for specific task
    await matrixPage.search("groceries");
    
    // Only the matching task should be visible
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Buy groceries" })).toBeVisible();
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Complete project report" })).not.toBeVisible();
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Call mom" })).not.toBeVisible();
  });

  test("should clear search and show all tasks", async ({ page }) => {
    // Create tasks
    await matrixPage.createTask("Task one");
    await matrixPage.createTask("Task two");
    
    await page.waitForTimeout(500);
    
    const initialCount = await matrixPage.getTaskCount();
    expect(initialCount).toBe(2);
    
    // Search
    await matrixPage.search("one");
    
    const searchCount = await matrixPage.getTaskCount();
    expect(searchCount).toBe(1);
    
    // Clear search
    await matrixPage.clearSearch();
    
    const finalCount = await matrixPage.getTaskCount();
    expect(finalCount).toBe(2);
  });

  test("should show no results for non-matching search", async ({ page }) => {
    await matrixPage.createTask("Existing task");
    
    await page.waitForTimeout(500);
    
    // Search for non-existent task
    await matrixPage.search("nonexistent task");
    
    // No tasks should be visible
    const taskCount = await matrixPage.getTaskCount();
    expect(taskCount).toBe(0);
  });

  test("should be case-insensitive", async ({ page }) => {
    await matrixPage.createTask("Test Task");
    
    await page.waitForTimeout(500);
    
    // Search with different case
    await matrixPage.search("test task");
    
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Test Task" })).toBeVisible();
    
    await matrixPage.search("TEST TASK");
    
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Test Task" })).toBeVisible();
  });

  test("should handle partial matches", async ({ page }) => {
    await matrixPage.createTask("Complete the project report");
    
    await page.waitForTimeout(500);
    
    // Search for partial word
    await matrixPage.search("project");
    
    await expect(page.locator("[data-testid='task-card']").filter({ hasText: "Complete the project report" })).toBeVisible();
  });
});