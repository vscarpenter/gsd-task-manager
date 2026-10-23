import { test, expect } from "./fixtures/test-fixtures";

/**
 * Controls that must fit beside their neighbours, measured at real sizes.
 *
 * Each of these broke at only some widths or heights: a label squeezed to one
 * word per line, a button left alone on a row, an axis label that drifted off
 * its row. jsdom has no layout, so the unit suite pins the class contract and
 * these check the geometry.
 */
test.describe("Layout fit", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test.describe("on a touch phone", () => {
    test.use({ hasTouch: true });

    // The touch-sized theme control is about 255px wide. Beside it the label
    // column fell to 53px at 390, one word per line, and to nothing at 320.
    test("the theme control moves below its label instead of squeezing it", async ({ page }) => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/settings");
        const description = page.getByText("Choose your visual style");
        // A zero-width label column makes the description "hidden".
        await expect(description, `description at ${width}px`).toBeVisible();

        const lines = await description.evaluate(
          (el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)
        );
        expect(Math.round(lines), `description lines at ${width}px`).toBe(1);
      }
    });
  });
});
