import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, findTopbarCover, waitForAppLoad } from "./helpers/test-helpers";
import { findHiddenFocusStops, startAtMainContent } from "./helpers/focus-visibility";

/**
 * The type ramp is rem, so text follows the browser's default font size.
 * These specs raise it to 150% (24px) the way a user does, through Chrome's
 * font settings, and check that the layout reflows instead of scrolling
 * sideways or clipping. Only Chromium exposes the setting.
 */
const LARGE_TEXT_PX = 24;
const LARGE_FIXED_PX = 20;
// 200%, the level WCAG asks text to survive.
const DOUBLE_TEXT_PX = 32;
const DOUBLE_FIXED_PX = 26;
// The grid's minmax(280px,1fr) row floor.
const PANE_FLOOR_PX = 280;
// The narrowest the intro sentence may get before it moves to its own line.
const SENTENCE_FLOOR_REM = 12;
const PHONE_TASKS = [
  "Pay rent !!", "Plan the roadmap *", "Reply to the landlord !", "Clean the garage",
  "File taxes !!", "Read the RFC *", "Book the dentist !", "Sort the photos", "Renew passport *",
];
const PHONE_PRESSES = 60;
const PHONE_FOCUS_TIMEOUT_MS = 150_000;

async function useLargeText(page: Page, standard = LARGE_TEXT_PX, fixed = LARGE_FIXED_PX): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard, fixed } });
}

/** The root font size the page actually got, so a check can't pass on default text. */
const rootFontPx = (page: Page) =>
  page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));

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
  // The date and the Schedule button grow with the text and never shrink, so
  // the sentence between them fell to 139px, about five words per line.
  test("the intro sentence keeps 12rem at 150% text", async ({ page }) => {
    await useLargeText(page);
    await page.clock.setFixedTime(new Date("2026-09-30T10:00:00"));
    await page.reload();
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, "Plan the roadmap *");
    await createTaskViaCaptureBar(page, "Read the RFC *");

    const sentence = await page.locator("section:has(h1) > p").boundingBox();
    expect(sentence!.width).toBeGreaterThanOrEqual(SENTENCE_FLOOR_REM * LARGE_TEXT_PX);
  });

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

    // Checked along the whole scroll. The capture bar covered the header for
    // one stretch of it, and the date in the heading moved that stretch. A
    // check at one offset passed or failed by the calendar.
    expect(await findTopbarCover(page), "something covers the header").toBeNull();
  });

  // The search box was a fixed 18rem, 432px at this size. It pushed the command
  // button onto a row of its own and made the header 187px tall.
  test("the topbar keeps search, sync, and the command button on one row", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await useLargeText(page);
    await waitForAppLoad(page);

    const centerY = async (selector: string) => {
      const rect = await page.locator(selector).first().boundingBox();
      return rect!.y + rect!.height / 2;
    };
    const search = await centerY("[data-testid='search-input']");
    for (const selector of ["[data-testid='sync-button']", "button[aria-label='Open command palette']"]) {
      expect(Math.abs((await centerY(selector)) - search), selector).toBeLessThanOrEqual(4);
    }
  });
});

// At 200% text the sticky topbar is tall enough that Tab parked dozens of
// stops under it on the matrix. Reduced motion lands each focus scroll at once.
test.describe("Text scaling at 200%", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ browserName, clearIndexedDB }) => {
    test.skip(browserName !== "chromium", "only Chromium exposes the default font size");
  });

  test("focus clears the fixed chrome at 200% text", async ({ page }) => {
    await useLargeText(page, DOUBLE_TEXT_PX, DOUBLE_FIXED_PX);
    await waitForAppLoad(page);
    for (const title of ["Pay rent !!", "Plan the roadmap *", "Reply to the landlord !", "Clean the garage"]) {
      await createTaskViaCaptureBar(page, title);
    }
    // Reload so the scroll to the last new card can't land after the reset to the top.
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForAppLoad(page);
    expect(await rootFontPx(page)).toBe(DOUBLE_TEXT_PX);
    await startAtMainContent(page);

    expect(await findHiddenFocusStops(page, 45)).toEqual([]);
  });
});

// On a phone the topbar wraps as text grows: 252px at 150%, where a fixed 8rem
// margin is 192px, so Shift+Tab parked dozens of stops under the returned bar.
test.describe("Focus at 150% text on a phone", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ browserName, clearIndexedDB }) => {
    test.skip(browserName !== "chromium", "only Chromium exposes the default font size");
  });

  test("focus clears the wrapped topbar", async ({ page }) => {
    test.setTimeout(PHONE_FOCUS_TIMEOUT_MS);
    await useLargeText(page);
    await waitForAppLoad(page);
    for (const title of PHONE_TASKS) await createTaskViaCaptureBar(page, title);
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForAppLoad(page);
    expect(await rootFontPx(page)).toBe(LARGE_TEXT_PX);
    await startAtMainContent(page);

    expect(await findHiddenFocusStops(page, PHONE_PRESSES)).toEqual([]);
  });
});
