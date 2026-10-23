import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, waitForAppLoad } from "./helpers/test-helpers";

/**
 * The type ramp is rem, so text follows the browser's default font size.
 * These specs raise it to 150% (24px) the way a user does, through Chrome's
 * font settings, and check that the layout reflows instead of scrolling
 * sideways or clipping. Only Chromium exposes the setting.
 */
const LARGE_TEXT_PX = 24;
// The grid's minmax(280px,1fr) row floor.
const PANE_FLOOR_PX = 280;

async function useLargeText(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: LARGE_TEXT_PX, fixed: 20 } });
}

const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("Text scaling at 150%", () => {
  test.beforeEach(async ({ browserName, clearIndexedDB }) => {
    test.skip(browserName !== "chromium", "only Chromium exposes the default font size");
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the review page and About reflow without scrolling sideways", async ({ page }) => {
      await useLargeText(page);
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Finished task !!");
      await createTaskViaCaptureBar(page, "Open task *");
      await page.getByTestId("complete-task").first().click();

      await page.goto("/dashboard");
      await expect(page.getByText(/Streak/i).first()).toBeVisible();
      expect(await sidewaysOverflow(page), "/dashboard").toBeLessThanOrEqual(0);

      await page.goto("/about");
      await expect(page.locator("main h1, main h2").first()).toBeVisible();
      expect(await sidewaysOverflow(page), "/about").toBeLessThanOrEqual(0);
    });
  });

  test("the icon rail keeps its labels inside the rail", async ({ page }) => {
    await useLargeText(page);
    await waitForAppLoad(page);
    const rail = page.getByRole("navigation", { name: "Primary navigation" });
    // system-ui is narrow San Francisco on macOS but a wider face such as DejaVu
    // Sans on Linux and Windows. Widen every glyph so the check holds on any
    // machine. Set through CSSOM, which the production CSP allows.
    await rail.evaluate((el) => {
      (el as HTMLElement).style.letterSpacing = "0.1em";
    });
    const label = rail.getByText("Collapse sidebar");
    await expect(label).toBeVisible();
    const [railBox, labelBox] = await Promise.all([rail.boundingBox(), label.boundingBox()]);
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width);
  });

  // Pinned to a 720px screen, the header, briefing, and capture bar took 28rem
  // at this size and left the matrix a 48px scroller. The page scrolls instead,
  // so both 280px pane rows get their full height.
  test("the matrix keeps both pane rows on a laptop-height screen", async ({ page }) => {
    await useLargeText(page);
    await waitForAppLoad(page);
    const gridBox = await page.getByTestId("matrix-grid").boundingBox();
    expect(gridBox!.height).toBeGreaterThanOrEqual(2 * PANE_FLOOR_PX);
  });

  test("scrolling that page leaves the rail and header uncovered", async ({ page }) => {
    await useLargeText(page);
    await waitForAppLoad(page);
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const rail = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(rail.getByText("Matrix")).toBeInViewport();

    // Whatever paints just inside the header's bottom edge must be the header.
    const header = await page.locator("header").first().boundingBox();
    const topmost = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest("header") !== null,
      [header!.x + header!.width / 2, header!.y + header!.height - 4]
    );
    expect(topmost, "something covers the header").toBe(true);
  });
});
