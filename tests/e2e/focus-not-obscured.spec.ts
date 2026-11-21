import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, waitForAppLoad } from "./helpers/test-helpers";
import { findHiddenFocusStops, startAtMainContent } from "./helpers/focus-visibility";

/**
 * WCAG 2.4.11 Focus Not Obscured (AA): a focused control may never sit fully
 * behind the sticky topbar or, on a phone, the fixed rail and capture dock.
 * Before the scroll margins, Tab parked focus under that chrome 26 times on the
 * phone matrix. Reduced motion makes each focus scroll land at once, so the
 * check needs no timing; the margins work the same with smooth scrolling.
 */
const PRESSES = 60;
const MULTI_ROUTE_TIMEOUT_MS = 180_000;
const SCROLLED_Y = 600;
const TASKS = [
  "Pay rent !!", "Plan the roadmap *", "Reply to the landlord !", "Clean the garage",
  "File taxes !!", "Read the RFC *", "Book the dentist !", "Sort the photos", "Renew passport *",
];

/**
 * Ends on a fresh load: after a capture the matrix scrolls to the new card on a
 * later frame, and that scroll must not land in the middle of a check.
 */
async function loadMatrixWithTasks(page: Page): Promise<void> {
  await waitForAppLoad(page);
  for (const title of TASKS) await createTaskViaCaptureBar(page, title);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppLoad(page);
}

async function hiddenStopsOn(page: Page, route: string): Promise<string[]> {
  await page.goto(route, { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible();
  await startAtMainContent(page);
  return findHiddenFocusStops(page, PRESSES);
}

test.describe("Focus not obscured", () => {
  test.use({ reducedMotion: "reduce" });

  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("focus never hides behind the dock, rail, or topbar", async ({ page }) => {
      await loadMatrixWithTasks(page);

      expect(await hiddenStopsOn(page, "/")).toEqual([]);
    });

    test("focus clears the rail on About and Review", async ({ page }) => {
      test.setTimeout(MULTI_ROUTE_TIMEOUT_MS);
      await loadMatrixWithTasks(page);

      for (const route of ["/about", "/dashboard"]) {
        expect(await hiddenStopsOn(page, route), route).toEqual([]);
      }
    });

    // The chrome is what the margins clear, so it carries none itself. The dock
    // input's margin would also wake revealCaptureInput, which stays dormant here.
    test("the topbar, rail, and dock carry no scroll margin", async ({ page }) => {
      await loadMatrixWithTasks(page);

      const margins = await page.evaluate(() => {
        const topbar = document.querySelector("[data-testid='search-input']")!.closest("header")!;
        const rail = document.querySelector("nav[aria-label='Primary navigation (mobile)']")!;
        const dockInput = document.querySelector("[data-testid='capture-input']")!;
        return [...topbar.querySelectorAll("a, button, input"), ...rail.querySelectorAll("a, button"), dockInput]
          .map((el) => getComputedStyle(el).scrollMarginTop);
      });
      expect([...new Set(margins)]).toEqual(["0px"]);

      await page.evaluate((y) => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: y, behavior: "instant" });
      }, SCROLLED_Y);
      await page.getByTestId("capture-input").focus();
      expect(await page.evaluate(() => window.scrollY)).toBe(SCROLLED_Y);
    });
  });

  for (const viewport of [{ width: 1280, height: 600 }, { width: 768, height: 640 }]) {
    test(`focus clears the sticky topbar at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      test.setTimeout(MULTI_ROUTE_TIMEOUT_MS);
      await page.setViewportSize(viewport);
      await loadMatrixWithTasks(page);

      for (const route of ["/", "/settings", "/about", "/dashboard"]) {
        expect(await hiddenStopsOn(page, route), route).toEqual([]);
      }
    });
  }

  // Pinned, the stage scrolls on its own. A topbar-sized margin there pushed 41
  // stops below a short stage, so the stage's controls carry none.
  test("focus stays visible inside a small pinned stage", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await loadMatrixWithTasks(page);

    expect(await hiddenStopsOn(page, "/")).toEqual([]);
    // In a 180px stage a margin cuts cards off rather than hiding them, which
    // the check above can't see, so the exemption is pinned directly too.
    const margins = await page.getByTestId("matrix-stage").locator("button").evaluateAll(
      (buttons) => buttons.map((button) => getComputedStyle(button).scrollMarginTop)
    );
    expect([...new Set(margins)]).toEqual(["0px"]);
  });
});
