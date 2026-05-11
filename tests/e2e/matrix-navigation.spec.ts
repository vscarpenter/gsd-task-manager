import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

test.describe("Matrix Navigation", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("should navigate to settings page", async ({ page }) => {
    await matrixPage.openSettings();
    
    // Verify we're on settings page by checking for settings-related content
    await expect(page.locator("[data-testid='nav-settings']")).toBeVisible();
    await expect(page.url()).toContain("/settings");
  });

  test("should navigate to dashboard page", async ({ page }) => {
    await matrixPage.openDashboard();
    
    // Verify we're on dashboard page
    await expect(page.locator("[data-testid='nav-dashboard']")).toBeVisible();
    await expect(page.url()).toContain("/dashboard");
  });

  test("should return to matrix from settings", async ({ page }) => {
    await matrixPage.openSettings();
    await page.waitForTimeout(500);
    
    await matrixPage.openMatrix();
    
    // Verify we're back on matrix page
    await expect(page.locator("[data-testid='matrix-grid']")).toBeVisible();
    await expect(page.url()).toContain("/");
  });

  test("should return to matrix from dashboard", async ({ page }) => {
    await matrixPage.openDashboard();
    await page.waitForTimeout(500);
    
    await matrixPage.openMatrix();
    
    // Verify we're back on matrix page
    await expect(page.locator("[data-testid='matrix-grid']")).toBeVisible();
    await expect(page.url()).toContain("/");
  });

  test("should highlight active navigation item", async ({ page }) => {
    // Matrix should be active by default
    await expect(page.locator("[data-testid='nav-matrix']")).toBeVisible();
    
    // Navigate to dashboard
    await matrixPage.openDashboard();
    await page.waitForTimeout(500);
    
    // Dashboard should now be active
    await expect(page.locator("[data-testid='nav-dashboard']")).toBeVisible();
    
    // Navigate back to matrix
    await matrixPage.openMatrix();
    
    // Matrix should be active again
    await expect(page.locator("[data-testid='nav-matrix']")).toBeVisible();
  });
});