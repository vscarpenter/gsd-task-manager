import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Settings sections that are NOT covered by settings-navigation.spec.ts:
 *  - Notifications section content
 *  - Archive section content + View archive link
 *  - About section content
 *  - Sync section visibility (hidden when sync disabled)
 *  - Hashchange-driven section selection (e.g. /settings#data)
 */
test.describe("Settings Sections", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("notifications section renders its controls", async ({ page }) => {
    await matrixPage.openSettings();
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Notifications" }).click();
    await expect(page.locator("main h2", { hasText: "Notifications" })).toBeVisible();

    // The notification settings section renders at least one switch
    // (browser notification toggle or default reminder toggle).
    const switches = page.locator("main").getByRole("switch");
    expect(await switches.count()).toBeGreaterThan(0);
  });

  test("archive section renders the auto-archive controls", async ({ page }) => {
    await matrixPage.openSettings();
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Archive" }).click();
    await expect(page.locator("main h2", { hasText: "Archive" })).toBeVisible();

    // Auto-archive toggle is always present (the "View archive" link is
    // conditionally rendered only when archivedCount > 0, so it isn't a
    // reliable signal that the section rendered).
    await expect(page.getByText("Auto-archive", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^run$/i })).toBeVisible();
  });

  test("about section renders app metadata", async ({ page }) => {
    await matrixPage.openSettings();
    await page.locator("aside.lg\\:block").getByRole("button", { name: "About" }).click();
    await expect(page.locator("main h2", { hasText: "About" })).toBeVisible();
  });

  test("sync section is hidden when cloud sync is disabled", async ({ page }) => {
    await matrixPage.openSettings();

    // The sidebar should NOT include a "Sync" entry when syncEnabled=false.
    const sidebar = page.locator("aside.lg\\:block");
    const syncButton = sidebar.getByRole("button", { name: "Cloud Sync" });
    await expect(syncButton).toHaveCount(0);
  });

  test("deep-linking to /settings#data activates Data & Storage section", async ({ page }) => {
    await page.goto("/settings#data");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();
  });

  test("deep-linking to /settings#archive activates Archive section", async ({ page }) => {
    await page.goto("/settings#archive");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main h2", { hasText: "Archive" })).toBeVisible();
  });

  test("hashchange after initial load swaps the active section", async ({ page }) => {
    await matrixPage.openSettings();
    await expect(page.locator("main h2", { hasText: "Appearance" })).toBeVisible();

    // Programmatic hash change should trigger the listener in the page
    await page.evaluate(() => {
      window.location.hash = "#data";
    });

    await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();
  });
});
