import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * E2E tests for sync/OAuth UI states.
 *
 * Tests the observable sync UI states on the matrix page and settings.
 * The sync dialog is a custom overlay (not native <dialog>), so we locate
 * it by its content rather than role="dialog".
 */

test.describe("Sync & Auth UI States", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("sync button shows 'not enabled' state by default", async ({ page }) => {
    await waitForAppLoad(page);

    // The sync button in the topbar shows "Sync not enabled"
    const syncButton = page.locator("button[aria-label='Sync not enabled']");
    await expect(syncButton).toBeVisible({ timeout: 5000 });
  });

  test("'Saved locally' indicator appears when sync is disabled", async ({ page }) => {
    await waitForAppLoad(page);

    // The status display shows "Saved locally"
    const savedLocally = page.locator("text=Saved locally");
    await expect(savedLocally).toBeVisible({ timeout: 5000 });
  });

  test("clicking sync button opens auth overlay", async ({ page }) => {
    await waitForAppLoad(page);

    // Click the sync button
    const syncButton = page.locator("button[aria-label='Sync not enabled']");
    await syncButton.click();
    await page.waitForTimeout(1000);

    // The auth overlay contains sign-in text
    const signInText = page.locator("text=/sign in|sync your tasks/i");
    await expect(signInText.first()).toBeVisible({ timeout: 5000 });
  });

  test("auth overlay shows OAuth provider options", async ({ page }) => {
    await waitForAppLoad(page);

    // Open the sync auth dialog
    const syncButton = page.locator("button[aria-label='Sync not enabled']");
    await syncButton.click();
    await page.waitForTimeout(1000);

    // Should show Google and/or GitHub OAuth buttons
    const oauthOption = page.locator("text=/Google|GitHub/i");
    await expect(oauthOption.first()).toBeVisible({ timeout: 5000 });
  });

  test("auth overlay can be closed", async ({ page }) => {
    await waitForAppLoad(page);

    // Open the auth dialog
    const syncButton = page.locator("button[aria-label='Sync not enabled']");
    await syncButton.click();
    await page.waitForTimeout(1000);

    // Find and verify the overlay opened
    const signInText = page.locator("text=/sign in|sync your tasks/i");
    await expect(signInText.first()).toBeVisible({ timeout: 5000 });

    // Close via the close button
    const closeButton = page.locator("button[aria-label='Close']");
    await closeButton.click();
    await page.waitForTimeout(500);

    // Overlay should be gone
    await expect(signInText.first()).not.toBeVisible();
  });

  test("settings page loads from matrix", async ({ page }) => {
    await waitForAppLoad(page);

    // Navigate to settings
    await page.locator("[data-testid='nav-settings']").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Settings page should have loaded — verify by URL or visible heading
    await expect(page).toHaveURL(/settings/, { timeout: 10000 });
  });
});
