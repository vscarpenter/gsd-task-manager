import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * E2E tests for the PWA install prompt.
 *
 * The install prompt component listens for the `beforeinstallprompt` event
 * and shows a dialog with install/dismiss options. We simulate this browser
 * event via page.evaluate() since Playwright doesn't fire it natively.
 *
 * Note: The component also checks `navigator.standalone` (Safari) and
 * `window.matchMedia('(display-mode: standalone)')` to detect if already installed.
 */

async function triggerInstallPrompt(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    // Create and dispatch a synthetic beforeinstallprompt event
    const event = new Event("beforeinstallprompt", {
      bubbles: true,
      cancelable: true,
    });
    // Add the prompt() method that the component expects
    (event as unknown as { prompt: () => Promise<void> }).prompt = () => Promise.resolve();
    (event as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice = Promise.resolve({
      outcome: "accepted",
    });
    window.dispatchEvent(event);
  });
}

async function simulateStandaloneMode(page: import("@playwright/test").Page) {
  // Override matchMedia to report standalone display mode
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => {
      if (query === "(display-mode: standalone)") {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        } as MediaQueryList;
      }
      return originalMatchMedia(query);
    };
    // Also set navigator.standalone for Safari
    Object.defineProperty(navigator, "standalone", { value: true, writable: false });
  });
}

test.describe("PWA Install Prompt", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("install prompt dialog appears when beforeinstallprompt fires", async ({ page }) => {
    await waitForAppLoad(page);

    // Trigger the install prompt event
    await triggerInstallPrompt(page);
    await page.waitForTimeout(500);

    // The install dialog should appear
    const installDialog = page.locator("[aria-labelledby='install-pwa-title']");
    await expect(installDialog).toBeVisible({ timeout: 5000 });
  });

  test("dismiss button closes the install prompt", async ({ page }) => {
    await waitForAppLoad(page);

    await triggerInstallPrompt(page);
    await page.waitForTimeout(500);

    const installDialog = page.locator("[aria-labelledby='install-pwa-title']");
    await expect(installDialog).toBeVisible({ timeout: 5000 });

    // Click dismiss
    const dismissButton = page.locator("button[aria-label='Dismiss install prompt']");
    await dismissButton.click();
    await page.waitForTimeout(500);

    // Dialog should be gone
    await expect(installDialog).not.toBeVisible();
  });

  test("install button triggers the native install prompt", async ({ page }) => {
    await waitForAppLoad(page);

    // Track whether prompt() was called
    await page.evaluate(() => {
      (window as unknown as { __promptCalled: boolean }).__promptCalled = false;
    });

    // Dispatch with a trackable prompt()
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", {
        bubbles: true,
        cancelable: true,
      });
      (event as unknown as { prompt: () => Promise<void> }).prompt = () => {
        (window as unknown as { __promptCalled: boolean }).__promptCalled = true;
        return Promise.resolve();
      };
      (event as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice = Promise.resolve({
        outcome: "accepted",
      });
      window.dispatchEvent(event);
    });

    await page.waitForTimeout(500);

    const installDialog = page.locator("[aria-labelledby='install-pwa-title']");
    await expect(installDialog).toBeVisible({ timeout: 5000 });

    // Click install button
    const installButton = page.getByRole("button", { name: /install/i }).first();
    await installButton.click();
    await page.waitForTimeout(500);

    // Verify prompt() was called
    const promptCalled = await page.evaluate(() => (window as unknown as { __promptCalled: boolean }).__promptCalled);
    expect(promptCalled).toBe(true);
  });

  test("no prompt shown when app is already installed (standalone mode)", async ({ page }) => {
    await simulateStandaloneMode(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppLoad(page);

    // Try to trigger the event — should be ignored in standalone mode
    await triggerInstallPrompt(page);
    await page.waitForTimeout(1000);

    // Dialog should NOT appear
    const installDialog = page.locator("[aria-labelledby='install-pwa-title']");
    await expect(installDialog).not.toBeVisible();
  });

  test("prompt does not reappear after being dismissed within cooldown", async ({ page }) => {
    await waitForAppLoad(page);

    // Trigger and dismiss
    await triggerInstallPrompt(page);
    await page.waitForTimeout(500);

    const installDialog = page.locator("[aria-labelledby='install-pwa-title']");
    await expect(installDialog).toBeVisible({ timeout: 5000 });

    const dismissButton = page.locator("button[aria-label='Dismiss install prompt']");
    await dismissButton.click();
    await page.waitForTimeout(500);
    await expect(installDialog).not.toBeVisible();

    // Trigger again immediately — should not reappear (cooldown)
    await triggerInstallPrompt(page);
    await page.waitForTimeout(1000);
    await expect(installDialog).not.toBeVisible();
  });
});
