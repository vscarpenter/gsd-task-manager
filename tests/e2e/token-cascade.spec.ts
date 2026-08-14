import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad, createTaskViaCaptureBar } from "./helpers/test-helpers";
import type { Locator } from "@playwright/test";

/**
 * Cascade regressions, measured in a real engine.
 *
 * Tailwind v4 orders declarations by cascade LAYER before specificity, and
 * unlayered CSS outranks everything in `@layer utilities` regardless of how
 * specific it is. That makes a one-line stylesheet edit able to silently
 * neutralise a colour utility sitting right there in the JSX — with no build
 * error, no lint warning, and nothing jsdom can observe, because the unit suite
 * never loads the built stylesheet.
 */
async function colorOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).color);
}

test.describe("Token cascade", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("the dialog close button keeps its muted colour and its hover change", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, "Cascade check !!");

    const card = page.locator("[data-testid='task-card']").filter({ hasText: "Cascade check" });
    await card.hover();
    await card.getByRole("button", { name: "Share task" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const close = dialog.getByRole("button", { name: "Close" });
    await expect(close).toBeVisible();

    // `.button-reset` sets `color: inherit`. Declared unlayered it beat
    // `text-foreground-muted`, so the control rendered at full foreground
    // strength — indistinguishable from the dialog's body text.
    const restColor = await colorOf(close);
    const bodyColor = await dialog.evaluate((el) => getComputedStyle(el).color);
    expect(restColor).not.toBe(bodyColor);

    // ...and `hover:text-foreground` was dead too, so the primary dismiss
    // control on every dialog in the app had no hover feedback at all.
    await close.hover();
    await expect
      .poll(async () => colorOf(close), { timeout: 2000 })
      .not.toBe(restColor);
  });
});
