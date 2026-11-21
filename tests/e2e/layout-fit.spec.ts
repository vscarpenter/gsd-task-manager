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
// Under the 40rem (640px) height a 64rem-wide shell needs before it pins.
// Narrower md windows need 52rem.
const UNPINNED_HEIGHT_PX = 600;
// Where a scrolled element's top sits when it's parked behind the topbar.
const PARKED_INSET_PX = 8;
// How far under the topbar the capture bar sits when it's in view but inside its scroll margin.
const VISIBLE_GAP_PX = 6;
// The narrowest the intro sentence may get before it moves to its own line.
const SENTENCE_FLOOR_REM = 12;
// The least height a pinned matrix stage may have.
const STAGE_FLOOR_REM = 10;
// The longest English weekday and a long month, in the date heading.
const LONG_DATE = new Date("2026-09-30T10:00:00");

const remPx = (page: Page, rem: number) =>
  page.evaluate((n) => n * Number.parseFloat(getComputedStyle(document.documentElement).fontSize), rem);

/** The intro with its widest parts: a long date and the plural Schedule label. */
async function loadLongIntro(page: Page): Promise<void> {
  await page.clock.setFixedTime(LONG_DATE);
  await page.reload();
  await waitForAppLoad(page);
  await createTaskViaCaptureBar(page, "Plan the roadmap *");
  await createTaskViaCaptureBar(page, "Read the RFC *");
}

const introSentence = (page: Page) => page.locator("section:has(h1) > p");
const scheduleButton = (page: Page) => page.getByRole("button", { name: /^Schedule( is empty| · )/ });

/** Turns on the smart-view strip, which adds a row above the stage. */
async function turnOnSmartViewStrip(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("GsdTaskManager");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("appPreferences", "readwrite");
      transaction.objectStore("appPreferences")
        .put({ id: "preferences", smartViewsEnabled: true, pinnedSmartViewIds: [], maxPinnedViews: 5 });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
  await page.reload();
  await waitForAppLoad(page);
  await expect(page.getByRole("group", { name: "Smart views" })).toBeVisible();
}

/**
 * Resizes and waits until the page has the new height. WebKit on Linux took
 * about 100ms after setViewportSize resolved.
 */
async function resizeTo(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(viewport.height);
}

/**
 * How the matrix shell lays out: pinned to the viewport, or scrolling with the
 * page. The shell decides a frame or more after a resize or a change above the
 * stage, so a check that expects a state waits for it with expect.poll.
 */
function readShell(page: Page) {
  return page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const stage = document.querySelector<HTMLElement>("[data-testid='matrix-stage']")!;
    return {
      mainOverflow: getComputedStyle(document.querySelector("main")!).overflowY,
      stageOverflow: getComputedStyle(stage).overflowY,
      stageHeight: stage.getBoundingClientRect().height,
    };
  });
}

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

  // The sentence sat between a date and a button that never shrink. At 768px on
  // a Wednesday it had 0px left, so it broke one word per line.
  test("the intro sentence keeps 12rem beside a long date at 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 640 });
    await loadLongIntro(page);

    const sentence = (await introSentence(page).boundingBox())!;
    const button = (await scheduleButton(page).boundingBox())!;
    expect(sentence.width).toBeGreaterThanOrEqual(await remPx(page, SENTENCE_FLOOR_REM));
    const overlaps = sentence.x < button.x + button.width && button.x < sentence.x + sentence.width
      && sentence.y < button.y + button.height && button.y < sentence.y + sentence.height;
    expect(overlaps, "the sentence runs into the Schedule button").toBe(false);
  });

  test("the intro row stays on one line at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadLongIntro(page);

    const date = await centerY(page.locator("section:has(h1) > div"));
    for (const [name, part] of [["sentence", introSentence(page)], ["button", scheduleButton(page)]] as const) {
      expect(Math.abs((await centerY(part)) - date), name).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
    }
  });

  // Below sm the row is a column, and there a flex-basis sets the height, so a
  // 12rem basis left about 150px of blank space under the sentence on a phone.
  test("the intro sentence takes only its own lines on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadLongIntro(page);

    const sentence = await introSentence(page).evaluate((p) => {
      const text = document.createRange();
      text.selectNodeContents(p);
      return {
        blank: p.getBoundingClientRect().height - text.getBoundingClientRect().height,
        fontSize: Number.parseFloat(getComputedStyle(p).fontSize),
      };
    });
    // A line's leading is the only space the box may hold beyond its text.
    expect(sentence.blank).toBeLessThan(sentence.fontSize);
  });

  // Wide enough to pin but short, the shell left the matrix a 98px scroller at
  // 768x640. Narrow md windows now need more height before they pin.
  test("narrow md windows scroll the page instead of pinning a slot", async ({ page }) => {
    for (const viewport of [{ width: 768, height: 640 }, { width: 900, height: 660 }]) {
      await page.setViewportSize(viewport);
      await waitForAppLoad(page);

      const shell = await readShell(page);
      const size = `${viewport.width}x${viewport.height}`;
      expect(shell.mainOverflow, `main at ${size}`).not.toBe("hidden");
      expect(shell.stageOverflow, `stage at ${size}`).toBe("visible");
    }
  });

  test("the shell pins only where the stage gets at least 10rem", async ({ page }) => {
    // The longest date, so the intro above the stage is at its tallest.
    await page.clock.setFixedTime(LONG_DATE);
    await page.reload();
    const floor = await remPx(page, STAGE_FLOOR_REM);
    for (const viewport of [{ width: 1280, height: 720 }, { width: 768, height: 1024 }]) {
      await resizeTo(page, viewport);
      await waitForAppLoad(page);

      const size = `${viewport.width}x${viewport.height}`;
      await expect.poll(async () => (await readShell(page)).mainOverflow, { message: `pinned at ${size}` }).toBe("hidden");
      expect((await readShell(page)).stageHeight, `stage at ${size}`).toBeGreaterThanOrEqual(floor);
    }

    // Whether 1024x640 pins depends on the font: Linux's wider sans wraps the
    // intro's button onto its own line. Pinned or not, the stage never drops
    // under the floor while the page is held still.
    await resizeTo(page, { width: 1024, height: 640 });
    await waitForAppLoad(page);
    const pinnedTooShort = async () => {
      const shell = await readShell(page);
      return shell.mainOverflow === "hidden" && shell.stageHeight < floor;
    };
    await expect.poll(pinnedTooShort, { message: "a pinned stage under 10rem at 1024x640" }).toBe(false);
  });

  // The smart-view strip adds a row above the stage. Pinned at 1024x640 it left
  // the stage 112px on macOS fonts, and CI's Linux fonts got 120px without the
  // strip. No size rule fits every font, so the shell measures the stage.
  test("a stage too short to pin lets the page scroll, and pins once there's room", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.clock.setFixedTime(LONG_DATE);
    await waitForAppLoad(page);
    await turnOnSmartViewStrip(page);

    // The strip renders after its preference loads, so the shell decides after
    // the page settles. CI's WebKit read the state two frames before it landed.
    await expect.poll(async () => (await readShell(page)).mainOverflow, { message: "main at 1024x640" }).not.toBe("hidden");
    expect((await readShell(page)).stageOverflow, "stage at 1024x640").toBe("visible");

    await resizeTo(page, { width: 1024, height: 800 });
    await expect.poll(async () => (await readShell(page)).mainOverflow, { message: "main at 1024x800" }).toBe("hidden");
    expect((await readShell(page)).stageHeight, "stage at 1024x800").toBeGreaterThanOrEqual(await remPx(page, STAGE_FLOOR_REM));
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

  // Below 40rem tall a wide shell stops pinning and the page scrolls. The capture
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
  // 800 has the tallest topbar, because its controls wrap onto a second row.
  // It also sits clear of the 768 breakpoint, where a scrollbar's width can
  // decide which layout a browser picks.
  for (const width of [800, 1280]) {
    test(`pressing n brings the capture bar out from under the topbar at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: UNPINNED_HEIGHT_PX });
      await waitForAppLoad(page);
      const topbarBottom = await parkCaptureInputBehindTopbar(page);

      await page.keyboard.press("n");

      await expect(page.getByTestId("capture-input")).toBeFocused();
      await expect.poll(() => captureBarTop(page)).toBeGreaterThanOrEqual(topbarBottom);
    });
  }

  // A press focuses a field that's already under the pointer. Revealing it then
  // moved it mid-press, which dragged the caret through the draft.
  test("clicking a visible capture bar leaves the page where it is", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: UNPINNED_HEIGHT_PX });
    await waitForAppLoad(page);
    const topbarBottom = await bottomEdge(page.getByRole("banner"));
    const restingTop = await captureBarTop(page);
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), restingTop - topbarBottom - VISIBLE_GAP_PX);
    const scrolledTo = await page.evaluate(() => window.scrollY);

    // A raw press: Playwright's click() first scrolls the field's margin into view itself.
    const field = (await page.getByTestId("capture-input").boundingBox())!;
    await page.mouse.click(field.x + field.width / 2, field.y + field.height / 2);

    await expect(page.getByTestId("capture-input")).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolledTo);
  });

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
