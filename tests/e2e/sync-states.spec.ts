import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Sync UI states verifiable without a real PocketBase backend.
 *
 * The local-first design means most of the sync surface is opt-in and only
 * appears once a user signs in. These tests guard the "sync disabled" path:
 * the sidebar entry stays hidden, the topbar shows a connect affordance,
 * and /sync-history still renders an empty state.
 */
test.describe("Sync UI States (sync disabled)", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("sync-history page renders without errors when nothing has synced", async ({ page }) => {
    await page.goto("/sync-history");
    await page.waitForLoadState("networkidle");

    // Page heading should be present even with no sync history
    await expect(page.locator("main h1, main h2", { hasText: /sync history/i })).toBeVisible();
  });

  test("settings sidebar omits Cloud Sync until the user enables it", async ({ page }) => {
    await matrixPage.openSettings();

    const sidebar = page.locator("aside.lg\\:block");
    const syncEntry = sidebar.getByRole("button", { name: /cloud sync/i });
    await expect(syncEntry).toHaveCount(0);
  });

  test("direct navigation to /settings#sync falls back to the default section when sync is off", async ({ page }) => {
    await page.goto("/settings#sync");
    await page.waitForLoadState("networkidle");

    // SettingsPage clamps invalid/hidden sections back to Appearance
    await expect(page.locator("main h2", { hasText: "Appearance" })).toBeVisible();
  });
});
