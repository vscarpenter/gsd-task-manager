import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * The matrix briefing, measured rather than asserted by class name.
 *
 * The briefing was compacted to one row so the matrix clears the fold on a
 * laptop. Both risks in that change are geometric, and jsdom cannot see
 * either: the row has to actually buy the fold back at 1440x900, and taking
 * the 1500px design frame literally overflowed a 390px phone by 64px, because
 * a 205px date, a sentence, and a 193px button do not share one line there.
 */
test.describe("Matrix briefing", () => {
  test("keeps all four quadrant headers above the fold at 1440x900", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForAppLoad(page);

    const headers = page.getByTestId("quadrant-header");
    await expect(headers).toHaveCount(4);

    for (let i = 0; i < 4; i += 1) {
      const box = await headers.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThan(900);
    }
  });

  test("does not scroll the page sideways on a phone", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForAppLoad(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("labels the axes only where the panes form a 2x2", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForAppLoad(page);
    await expect(page.getByTestId("matrix-axis-columns")).toBeVisible();
    await expect(page.getByTestId("matrix-axis-rows")).toBeVisible();

    // Below the container width that yields two columns the stack has no axes.
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(page.getByTestId("matrix-axis-columns")).toBeHidden();
    await expect(page.getByTestId("matrix-axis-rows")).toBeHidden();
  });
});
