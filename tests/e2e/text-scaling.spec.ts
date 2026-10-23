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
    const label = rail.getByText("Collapse sidebar");
    await expect(label).toBeVisible();
    const [railBox, labelBox] = await Promise.all([rail.boundingBox(), label.boundingBox()]);
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width);
  });
});
