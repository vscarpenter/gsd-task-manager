import type { Locator, Page } from "@playwright/test";
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
// A walk is 120 presses, each waiting three frames. One route took WebKit on
// CI 20 to 31 seconds, so the default 30 is too tight even for one.
const ONE_ROUTE_TIMEOUT_MS = 60_000;
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

// How far below whatever covers the top edge a parked control sits.
const PARK_GAP_PX = 12;
// Far enough down the board that parking it scrolls the page down, which is
// what tucks a phone's topbar away.
const PARKED_CARD = 3;
const COMPACT_QUERY = "(max-width: 767px)";

// A downward step the scroll chrome reads as a scroll, not jitter.
const TUCK_STEP_PX = 40;

/**
 * Scrolls down until `control` sits just below whatever covers the top edge:
 * the topbar on a laptop, nothing on a phone, where scrolling down tucks the bar
 * away. The tuck only happens once the scroll chrome is listening, which under
 * load can be after the first scroll, so a phone retries a step up and back down.
 */
async function parkNearTop(page: Page, control: Locator): Promise<number> {
  const { parkedY, compact } = await control.evaluate((el, { gap, query }) => {
    const bar = document.querySelector("[data-testid='search-input']")!.closest("header")!;
    const tucks = matchMedia(query).matches;
    const cover = tucks ? 0 : bar.getBoundingClientRect().height;
    return { parkedY: el.getBoundingClientRect().top + window.scrollY - cover - gap, compact: tucks };
  }, { gap: PARK_GAP_PX, query: COMPACT_QUERY });
  const scrollTo = (top: number) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
  if (!compact) {
    await scrollTo(parkedY);
  } else {
    await expect(async () => {
      await scrollTo(parkedY - TUCK_STEP_PX);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await scrollTo(parkedY);
      await expect(page.locator("header[data-chrome-hidden='true']")).toHaveCount(1, { timeout: 500 });
    }).toPass();
  }
  return page.evaluate(() => window.scrollY);
}

/** Focuses a control the way a keyboard user who reached it would: in place. */
const focusInPlace = (control: Locator) => control.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));

/**
 * Every page offset painted, frame by frame, while `act` runs and for a few
 * frames after. Closing the drawer jumped the page 116px in Chromium and the
 * browser put it back a frame later, so a check of the final offset missed it.
 * Frames rather than scroll events: when a modal's scroll lock lifts, WebKit
 * reports an offset that it usually doesn't paint.
 */
async function scrollOffsetsDuring(page: Page, act: () => Promise<void>): Promise<number[]> {
  await page.evaluate(() => {
    const sampler = { offsets: new Set([window.scrollY]), done: false };
    const sample = () => {
      sampler.offsets.add(window.scrollY);
      if (!sampler.done) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    Object.assign(window, { __sampler: sampler });
  });
  await act();
  return page.evaluate(async () => {
    for (let frame = 0; frame < 10; frame += 1) await new Promise(requestAnimationFrame);
    const sampler = (window as unknown as { __sampler: { offsets: Set<number>; done: boolean } }).__sampler;
    sampler.done = true;
    return [...sampler.offsets];
  });
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
      test.setTimeout(ONE_ROUTE_TIMEOUT_MS);
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

  // Signed out at 768px the topbar wraps to two rows, 131px, which a fixed 8rem
  // margin missed by 3px: a control's top edge and focus ring sat under it.
  test("the top margin covers the topbar however it wraps", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 640 });
    await loadMatrixWithTasks(page);

    const { bar, margins } = await page.evaluate(() => ({
      bar: document.querySelector("[data-testid='search-input']")!.closest("header")!.getBoundingClientRect().height,
      margins: [...document.querySelectorAll("main button")].map((el) => Number.parseFloat(getComputedStyle(el).scrollMarginTop)),
    }));
    expect(Math.min(...margins)).toBeGreaterThanOrEqual(bar);
  });

  // Closing a menu or the drawer puts focus back on the control the user left,
  // which is still in view. A plain focus() inside the margin band scrolled
  // anyway: 45px on a laptop, 88px on a phone, where it also brought back the
  // tucked topbar. Firefox recentered the page.
  test.describe("returning focus", () => {
    // WebKit moves the page itself when a modal's scroll lock lifts: 958 to 290
    // on a phone. For the card menu that happens before focus returns, with
    // every scroll margin forced to 0. The drawer reached the same 290 once in a
    // full run, though its focus returns with preventScroll.
    test.fixme(({ browserName }) => browserName === "webkit", "WebKit jumps the page when a modal's scroll lock lifts");

    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 600 }]) {
      test(`closing a card menu leaves the page in place at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await loadMatrixWithTasks(page);
        const trigger = page.getByRole("button", { name: "More actions" }).nth(PARKED_CARD);
        const parkedY = await parkNearTop(page, trigger);
        await focusInPlace(trigger);

        const offsets = await scrollOffsetsDuring(page, async () => {
          await page.keyboard.press("Enter");
          await expect(page.getByRole("menu")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(trigger).toBeFocused();
        });

        expect(offsets).toEqual([parkedY]);
      });
    }

    test("closing the edit drawer leaves the page in place on a phone", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await loadMatrixWithTasks(page);
      const edit = page.getByRole("button", { name: "Edit task" }).nth(PARKED_CARD);
      const parkedY = await parkNearTop(page, edit);
      await focusInPlace(edit);

      const offsets = await scrollOffsetsDuring(page, async () => {
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("edit-title")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(edit).toBeFocused();
      });

      expect(offsets).toEqual([parkedY]);
    });
  });

  // Pinned, the stage scrolls on its own. A topbar-sized margin there pushed 41
  // stops below a short stage, so the stage's controls carry none. 700px tall,
  // because at 640 Linux fonts leave too little room to pin.
  test("focus stays visible inside a small pinned stage", async ({ page }) => {
    test.setTimeout(ONE_ROUTE_TIMEOUT_MS);
    await page.setViewportSize({ width: 1024, height: 700 });
    await loadMatrixWithTasks(page);
    await expect(page.locator("main")).toHaveCSS("overflow-y", "hidden");

    expect(await hiddenStopsOn(page, "/")).toEqual([]);
    // In a 180px stage a margin cuts cards off rather than hiding them, which
    // the check above can't see, so the exemption is pinned directly too.
    const margins = await page.getByTestId("matrix-stage").locator("button").evaluateAll(
      (buttons) => buttons.map((button) => getComputedStyle(button).scrollMarginTop)
    );
    expect([...new Set(margins)]).toEqual(["0px"]);
  });
});
