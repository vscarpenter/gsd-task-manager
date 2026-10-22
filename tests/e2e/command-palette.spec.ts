import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Keyboard selection in the command palette, read from computed style.
 *
 * cmdk marks every row with data-selected, "true" on the current row and
 * "false" on the rest. A class check cannot tell a presence selector from a
 * value selector, so these specs read the fill the browser actually paints.
 */
test.describe("Command palette selection", () => {
  test.beforeEach(async ({ page, clearIndexedDB }) => {
    await waitForAppLoad(page);
  });

  test("fills only the selected row, and ArrowDown moves the fill", async ({ page }) => {
    // Hover paints the same fill, so keep the pointer off the list.
    await page.mouse.move(0, 0);
    await page.keyboard.press("ControlOrMeta+k");

    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();

    const filledRows = () =>
      options.evaluateAll((rows) =>
        rows
          .map((row, index) => ({ index, fill: getComputedStyle(row).backgroundColor }))
          .filter((row) => row.fill !== "rgba(0, 0, 0, 0)")
          .map((row) => row.index)
      );

    await expect.poll(filledRows).toEqual([0]);
    await page.keyboard.press("ArrowDown");
    await expect.poll(filledRows).toEqual([1]);
  });
});
