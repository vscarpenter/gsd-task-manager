import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";
import type { Page } from "@playwright/test";

async function gotoRememberedMatrix(page: Page): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.locator("[data-testid='matrix-grid']").waitFor({ state: "visible", timeout: 10000 });
      return;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.includes("NS_BINDING_ABORTED")) continue;
      if (attempt === 0) continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Remembered launch did not reach the matrix");
}

test.describe("First-time Redirect", () => {
  test.use({ firstTimeVisitor: true });

  test("redirects first-time visitors to /about and remembers the launch flag", async ({ page, clearIndexedDB }) => {

    await expect(page).toHaveURL(/\/about\/?(?:[?#].*)?$/);
    await expect(page.getByRole("link", { name: /open app/i })).toBeVisible();
    await expect(page.locator("main h1", { hasText: /stop juggling/i })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("gsd-has-launched"))).toBe("true");
    await page.evaluate(() => localStorage.setItem("gsd-onboarding-seen", "true"));

    await gotoRememberedMatrix(page);
    await expect(page).not.toHaveURL(/\/about(?:[?#].*)?$/);
    await waitForAppLoad(page);
  });
});
