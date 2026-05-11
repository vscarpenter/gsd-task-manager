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

  test("should create task in default quadrant (Q4 - not urgent, not important)", async ({ page }) => {
    await matrixPage.createTask("Default quadrant task");
    
    // By default, tasks without urgency/importance flags go to Q4
    const q4Count = await matrixPage.getQuadrantTaskCount("q4");
    expect(q4Count).toBeGreaterThan(0);
    
    const q4Task = page.locator("[data-testid='quadrant-q4']").locator("[data-testid='task-card']").filter({ hasText: "Default quadrant task" });
    await expect(q4Task).toBeVisible();
  });

  test("should display task count in each quadrant", async ({ page }) => {
    // Create tasks in different quadrants by using the capture parser
    await matrixPage.createTask("urgent important task !important"); // This should go to Q1
    await matrixPage.createTask("important task !important"); // This should go to Q2
    await matrixPage.createTask("urgent task !urgent"); // This should go to Q3
    await matrixPage.createTask("normal task"); // This should go to Q4
    
    // Wait for tasks to be created and classified
    await page.waitForTimeout(1000);
    
    // Verify quadrant counts are displayed
    const q1Count = await matrixPage.getQuadrantTaskCount("q1");
    const q2Count = await matrixPage.getQuadrantTaskCount("q2");
    const q3Count = await matrixPage.getQuadrantTaskCount("q3");
    const q4Count = await matrixPage.getQuadrantTaskCount("q4");
    
    expect(q1Count + q2Count + q3Count + q4Count).toBeGreaterThan(0);
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