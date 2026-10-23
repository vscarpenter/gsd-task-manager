import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Controls that must fit beside their neighbours, measured at real sizes.
 *
 * Each of these broke at only some widths or heights: a label squeezed to one
 * word per line, a button left alone on a row, an axis label that drifted off
 * its row. jsdom has no layout, so the unit suite pins the class contract and
 * these check the geometry.
 */
const ROW_TOLERANCE_PX = 4;

async function centerY(locator: Locator): Promise<number> {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("Element has no bounding box");
  return rect.y + rect.height / 2;
}

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

  // The search box was a fixed 18rem, so the bar's last control wrapped onto a
  // row of its own: at 900px the command button sat alone under the title.
  test("the command button never sits alone on a row", async ({ page }) => {
    for (const width of [768, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await waitForAppLoad(page);

      const palette = await centerY(page.getByRole("button", { name: "Open command palette" }));
      const sync = await centerY(page.getByTestId("sync-button"));
      expect(Math.abs(palette - sync), `at ${width}px`).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
    }
  });

  // On a screen too short for two 280px pane rows, the stage scrolls and each
  // row keeps its floor. The labels used to split the visible height instead,
  // so at 800px tall "Not important" sat 122px above the middle of its row.
  test("each row label stays level with its row on a short screen", async ({ page }) => {
    for (const height of [720, 800]) {
      await page.setViewportSize({ width: 1280, height });
      await waitForAppLoad(page);

      const labels = page.getByTestId("matrix-axis-rows").locator("p");
      for (const [index, pane] of ["quadrant-q1", "quadrant-q3"].entries()) {
        const drift = Math.abs((await centerY(labels.nth(index))) - (await centerY(page.getByTestId(pane))));
        expect(drift, `${pane} label at ${height}px tall`).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
      }
    }
  });
});
