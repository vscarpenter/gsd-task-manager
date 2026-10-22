import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, waitForAppLoad } from "./helpers/test-helpers";

/**
 * Touch swipe actions on matrix cards, in a real browser.
 *
 * The gesture vocabulary matches the iOS app: a rightward swipe reveals Complete
 * and a full swipe commits it; a leftward swipe reveals Snooze then Delete, tap
 * only. Firefox and WebKit have no touch injection, so the swipe is driven with
 * synthetic pointer events of `pointerType: "touch"`. That pins the gesture
 * state machine across all three engines; the mouse test uses a real mouse.
 */

async function swipe(
  surface: Locator,
  dx: number,
  end: "pointerup" | "pointercancel" = "pointerup"
): Promise<void> {
  const box = await surface.boundingBox();
  if (!box) throw new Error("swipe surface has no box");
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2;
  const at = (x: number) => ({ pointerType: "touch", pointerId: 1, isPrimary: true, clientX: x, clientY: y });
  await surface.dispatchEvent("pointerdown", at(startX));
  await surface.dispatchEvent("pointermove", at(startX + dx / 2));
  await surface.dispatchEvent("pointermove", at(startX + dx));
  await surface.dispatchEvent(end, at(startX + dx));
}

function swipeRow(page: Page, title: string): Locator {
  return page.getByTestId("task-card-swipe").filter({ hasText: title });
}

/**
 * A real finger, through Chromium's touch injection. Synthetic pointer events
 * skip implicit pointer capture, which is exactly where a real swipe once broke.
 */
async function realSwipe(
  page: Page,
  surface: Locator,
  dx: number,
  end: "touchEnd" | "touchCancel" = "touchEnd"
): Promise<void> {
  // A touch lands by coordinates, and the fixed mobile dock covers the bottom of
  // the screen, so center the card and prove the finger actually lands on it.
  // "instant" overrides the page's smooth scrolling, which would move the card
  // after it was measured.
  await surface.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = await surface.boundingBox();
  if (!box) throw new Error("swipe surface has no box");
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2;
  const lands = await surface.evaluate(
    (el, point) => el.contains(document.elementFromPoint(point.x, point.y)),
    { x: startX, y }
  );
  if (!lands) throw new Error("the touch point is covered, so the finger would miss the card");
  const cdp = await page.context().newCDPSession(page);
  const STEPS = 8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y }] });
  for (let step = 1; step <= STEPS; step++) {
    const x = startX + (dx * step) / STEPS;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: end, touchPoints: [] });
  await cdp.detach();
}

test.describe("Touch swipe actions", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test.describe("on a touch viewport", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("a full rightward swipe completes the task with an Undo", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Swipe to complete");
      const row = swipeRow(page, "Swipe to complete");

      await swipe(row.getByTestId("task-card-swipe-surface"), 260);

      await expect(row).toBeHidden();
      await expect(page.getByText("Task completed")).toBeVisible();
    });

    test("a full swipe the browser cancels never completes the task", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Interrupted swipe");
      const row = swipeRow(page, "Interrupted swipe");

      await swipe(row.getByTestId("task-card-swipe-surface"), 260, "pointercancel");

      await expect(row).toBeVisible();
      await expect(row.getByTestId("swipe-complete")).toHaveCount(0);
      await expect(page.getByText("Task completed")).toHaveCount(0);
    });

    test("a short rightward swipe reveals Complete for a tap", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Reveal then tap");
      const row = swipeRow(page, "Reveal then tap");

      await swipe(row.getByTestId("task-card-swipe-surface"), 70);
      await expect(row.getByTestId("swipe-complete")).toBeVisible();
      await row.getByTestId("swipe-complete").click();

      await expect(row).toBeHidden();
      await expect(page.getByText("Task completed")).toBeVisible();
    });

    test("a leftward swipe reveals Snooze then Delete, and Snooze quiets the task", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Swipe to snooze");
      const row = swipeRow(page, "Swipe to snooze");

      await swipe(row.getByTestId("task-card-swipe-surface"), -120);

      const strip = row.getByTestId("swipe-trailing");
      await expect(strip).toBeVisible();
      await expect(strip.getByRole("button")).toHaveText(["Snooze", "Delete"]);

      await strip.getByTestId("swipe-snooze").click();
      await expect(page.getByText("Snoozed for 1 hour")).toBeVisible();
      await expect(row.getByTestId("task-card-snoozed-chip")).toHaveText(/Snoozed 1h/);
      await expect(row.getByTestId("swipe-trailing")).toBeHidden();
    });

    test("Delete from the trailing strip removes the card with an Undo", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Swipe to delete");
      const row = swipeRow(page, "Swipe to delete");

      await swipe(row.getByTestId("task-card-swipe-surface"), -120);
      await row.getByTestId("swipe-delete").click();

      await expect(row).toHaveCount(0);
      await expect(page.getByText("Task deleted")).toBeVisible();
    });

    test("a full leftward swipe opens the strip but never commits", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "No accidental delete");
      const row = swipeRow(page, "No accidental delete");

      await swipe(row.getByTestId("task-card-swipe-surface"), -340);

      await expect(row.getByTestId("swipe-delete")).toBeVisible();
      await expect(row).toHaveCount(1);
      await expect(page.getByText("Task deleted")).toHaveCount(0);
    });
  });

  test.describe("with real touch input", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("a real swipe opens the row through implicit pointer capture", async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "only Chromium can inject real touch");
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Real finger");
      const row = swipeRow(page, "Real finger");

      await realSwipe(page, row.getByTestId("task-card-swipe-surface"), -120);

      await expect(row.getByTestId("swipe-trailing")).toBeVisible();
    });

    test("a real full swipe the system cancels completes nothing", async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "only Chromium can inject real touch");
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Real interruption");
      const row = swipeRow(page, "Real interruption");

      await realSwipe(page, row.getByTestId("task-card-swipe-surface"), 260, "touchCancel");

      await expect(row).toBeVisible();
      await expect(row.getByTestId("swipe-complete")).toHaveCount(0);
      await expect(page.getByText("Task completed")).toHaveCount(0);
    });
  });

  test.describe("with a mouse", () => {
    test("a horizontal mouse drag on the card body reveals nothing", async ({ page }) => {
      await waitForAppLoad(page);
      await createTaskViaCaptureBar(page, "Mouse drag");
      const row = swipeRow(page, "Mouse drag");
      const box = await row.getByTestId("task-card-swipe-surface").boundingBox();
      if (!box) throw new Error("card has no box");

      // Start on the card's description lane, clear of the grip and the disc.
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.8);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.55 + 120, box.y + box.height * 0.8, { steps: 6 });
      await page.mouse.up();

      await expect(row.getByTestId("swipe-leading")).toHaveCount(0);
      await expect(row.getByTestId("swipe-trailing")).toHaveCount(0);
      await expect(row).toBeVisible();
    });
  });
});
