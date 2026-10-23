import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, waitForAppLoad } from "./helpers/test-helpers";

/**
 * Toasts float over every surface, so their text has to clear WCAG AA on the
 * toast's own fill. Sonner's built-in success pair measured 4.25:1 in light
 * mode. axe only sees a toast while one happens to be on screen, so this
 * measures the colors the browser actually computes.
 */
const AA_TEXT = 4.5;

function contrastOf(toast: Locator): Promise<number> {
  return toast.evaluate((el) => {
    // Chromium reports color-mix() results as color(srgb …) in 0-1 channels.
    const channels = (value: string): number[] => {
      const nums = (value.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
      return value.startsWith("color(") ? nums : nums.map((n) => n / 255);
    };
    const luminance = (rgb: number[]): number => {
      const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const style = getComputedStyle(el);
    const text = luminance(channels(style.color));
    const fill = luminance(channels(style.backgroundColor));
    return (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05);
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`Toast contrast in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test.beforeEach(async ({ clearIndexedDB }) => {
      // Fixture clears IndexedDB
    });

    test("the success toast's text clears AA on its fill", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Renew passport");

      const toast = page.locator("[data-sonner-toast][data-type='success']").first();
      await expect(toast).toBeVisible();
      expect(await contrastOf(toast)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });
}
