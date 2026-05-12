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

  test("should navigate between settings sections", async ({ page }) => {
    await matrixPage.openSettings();

    // Default section is Appearance — the section heading lives in the SectionCard
    await expect(page.locator("main h2", { hasText: "Appearance" })).toBeVisible();

    // Click into Notifications via the sidebar (use the desktop nav for stability)
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Notifications" }).click();
    await expect(page).toHaveURL(/#notifications$/);
    await expect(page.locator("main h2", { hasText: "Notifications" })).toBeVisible();

    // Click into Data & Storage
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Data & Storage" }).click();
    await expect(page).toHaveURL(/#data$/);
    await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();

    // Back to Appearance
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Appearance" }).click();
    await expect(page).toHaveURL(/#appearance$/);
    await expect(page.locator("main h2", { hasText: "Appearance" })).toBeVisible();
  });

  test("should change theme via appearance settings", async ({ page }) => {
    await matrixPage.openSettings();

    const darkBtn = page.getByRole("button", { name: "Dark", exact: true });
    const lightBtn = page.getByRole("button", { name: "Light", exact: true });

    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true");
    await expect(lightBtn).toHaveAttribute("aria-pressed", "false");
    // next-themes applies the class on <html>
    await expect(page.locator("html")).toHaveClass(/dark/);

    await lightBtn.click();
    await expect(lightBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("should toggle show-completed setting", async ({ page }) => {
    await matrixPage.openSettings();

    // The Show Completed switch sits in the SettingsRow labeled "Show completed"
    const showCompletedSwitch = page.getByRole("switch").first();
    const initialChecked = await showCompletedSwitch.getAttribute("aria-checked");

    await showCompletedSwitch.click();
    const flippedChecked = await showCompletedSwitch.getAttribute("aria-checked");
    expect(flippedChecked).not.toBe(initialChecked);

    // Toggle back
    await showCompletedSwitch.click();
    await expect(showCompletedSwitch).toHaveAttribute("aria-checked", initialChecked ?? "false");
  });

  test("should trigger export download", async ({ page }) => {
    await matrixPage.createTask("Task to export");
    await matrixPage.openSettings();

    // Navigate to Data & Storage section where Export lives
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Data & Storage" }).click();
    await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export tasks/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^gsd-tasks-.*\.json$/);
  });
});