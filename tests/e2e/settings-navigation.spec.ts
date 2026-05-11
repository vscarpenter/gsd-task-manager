import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

test.describe("Settings Navigation", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("should open settings page", async ({ page }) => {
    await matrixPage.openSettings();
    
    // Verify we're on settings page
    await expect(page.url()).toContain("/settings");
    
    // Verify settings page content is visible (use main h1 to avoid banner h1)
    await expect(page.locator("main h1")).toContainText("Settings");
  });

  test("should display settings navigation", async ({ page }) => {
    await matrixPage.openSettings();
    
    // Verify navigation is still visible
    await expect(page.locator("[data-testid='nav-settings']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-matrix']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-dashboard']")).toBeVisible();
  });

  test("should navigate back to matrix from settings", async ({ page }) => {
    await matrixPage.openSettings();
    await page.waitForTimeout(500);
    
    await matrixPage.openMatrix();
    
    // Verify we're back on matrix page
    await expect(page.locator("[data-testid='matrix-grid']")).toBeVisible();
    await expect(page.url()).toContain("/");
  });
});