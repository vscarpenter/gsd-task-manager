import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, findTopbarCover, waitForAppLoad } from "./helpers/test-helpers";

/**
 * Controls that must fit beside their neighbours, measured at real sizes.
 *
 * Each of these broke at only some widths or heights: a label squeezed to one
 * word per line, a button left alone on a row, an axis label that drifted off
 * its row. jsdom has no layout, so the unit suite pins the class contract and
 * these check the geometry.
 */
const ROW_TOLERANCE_PX = 4;
// Under the 40rem (640px) height the shell needs before it pins.
const UNPINNED_HEIGHT_PX = 600;
// Where a scrolled element's top sits when it's parked behind the topbar.
const PARKED_INSET_PX = 8;

async function centerY(locator: Locator): Promise<number> {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("Element has no bounding box");
  return rect.y + rect.height / 2;
}

async function bottomEdge(locator: Locator): Promise<number> {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("Element has no bounding box");
  return rect.y + rect.height;
}

/** Scrolls the capture input behind the sticky topbar and returns the topbar's bottom edge. */
async function parkCaptureInputBehindTopbar(page: Page): Promise<number> {
  const input = page.getByTestId("capture-input");
  const topbarBottom = await bottomEdge(page.getByRole("banner"));
  const inputTop = (await input.boundingBox())!.y;
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), inputTop - PARKED_INSET_PX);
  expect((await input.boundingBox())!.y, "the input starts behind the topbar").toBeLessThan(topbarBottom);
  return topbarBottom;
}

/** The focus ring is on the bar, not the input, so the whole bar has to clear the topbar. */
async function captureBarTop(page: Page): Promise<number> {
  return (await page.getByTestId("capture-bar").boundingBox())!.y;
}

test.describe("Layout fit", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test.describe("on a touch phone", () => {
    test.use({ hasTouch: true });

    // Inside the shared buttons' 16px padding, "Keep editing" wrapped onto two
    // lines beside the discard prompt at 390.
    test("the discard prompt keeps each action on one line", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Renew passport");
      await page.getByTestId("task-card").first().getByRole("button", { name: /edit/i }).first().click();
      await page.getByLabel(/description/i).fill("More context");
      await page.getByRole("button", { name: "Cancel" }).click();

      for (const name of ["Keep editing", "Discard"]) {
        const lines = await page.getByRole("button", { name }).evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getClientRects().length;
        });
        expect(lines, name).toBe(1);
      }
    });

    // "7 Days", "30 Days", and "90 Days" needed 312px, and the chart header
    // had 276 at 390, so "90 Days" dropped onto a second row.
    test("the review's period control keeps its options on one row", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Renew passport");

      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/dashboard");
        const options = page.getByRole("group", { name: /completion trend period/i }).locator("label");
        await expect(options.last()).toBeVisible();

        const drift = Math.abs((await centerY(options.first())) - (await centerY(options.last())));
        expect(drift, `at ${width}px`).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
      }
    });

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

  // Below 40rem tall the shell stops pinning and the page scrolls. The capture
  // bar's wrapper shared the topbar's z-index and came later in the DOM, so it
  // slid over the bar for about 100px of that scroll.
  test("nothing slides over the topbar when a short window scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: UNPINNED_HEIGHT_PX });
    await waitForAppLoad(page);

    expect(await findTopbarCover(page)).toBeNull();
  });

  // The capture bar now scrolls under the topbar. An input parked there is
  // still inside the window, so the browser saw no reason to scroll when it
  // took focus, and the next keystrokes went into a field nobody could see.
  // 768 has the tallest topbar, because its controls wrap onto a second row.
  for (const width of [768, 1280]) {
    test(`pressing n brings the capture bar out from under the topbar at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: UNPINNED_HEIGHT_PX });
      await waitForAppLoad(page);
      const topbarBottom = await parkCaptureInputBehindTopbar(page);

      await page.keyboard.press("n");

      await expect(page.getByTestId("capture-input")).toBeFocused();
      await expect.poll(() => captureBarTop(page)).toBeGreaterThanOrEqual(topbarBottom);
    });
  }

  // Focus stays in the bar after a capture while the page scrolls to the new
  // card. Typing then reveals the caret, but the browser stops at the window's
  // top edge, which is behind the topbar.
  test("typing brings the capture bar out from under the topbar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: UNPINNED_HEIGHT_PX });
    await waitForAppLoad(page);
    await page.getByTestId("capture-input").focus();
    const topbarBottom = await parkCaptureInputBehindTopbar(page);

    await page.keyboard.type("Call the plumber");

    await expect(page.getByTestId("capture-input")).toHaveValue("Call the plumber");
    await expect.poll(() => captureBarTop(page)).toBeGreaterThanOrEqual(topbarBottom);
  });
});
