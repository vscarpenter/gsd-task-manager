import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad, createTaskViaCaptureBar } from "./helpers/test-helpers";
import type { Locator } from "@playwright/test";

/**
 * Overlap regressions, measured rather than eyeballed.
 *
 * jsdom has no layout, so these three defects — a grip covering a glyph, a
 * fixed bar covering a card, a dialog's actions below the fold — are invisible
 * to the unit suite by construction. They need real boxes at a real viewport.
 */
async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("Element has no bounding box");
  return rect;
}

test.describe("Layout overlap", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  // The grip floats in the lane between the quadrant spine and the title. It is
  // an opaque-on-hover box painted at z-10, so anything it overlaps it erases —
  // and a lane it merely *touches* re-breaks on the next subpixel rounding.
  // Both neighbours therefore get a real gap, not a shared edge.
  const GRIP_CLEARANCE = 2;

  test("the drag grip clears the title's first character", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, "QA TEST 3 !!");

    const card = page.locator("[data-testid='task-card']").filter({ hasText: "QA TEST 3" });
    await card.hover();

    const grip = card.getByRole("button", { name: "Drag to move task" });
    await expect(grip).toBeVisible();

    const gripBox = await box(grip);
    const titleBox = await box(card.locator("h3"));

    // The grip used to overhang the gutter by 8px, hiding the leading glyph —
    // "QA TEST 3" rendered as "A TEST 3". Reserving exactly enough space fixed
    // the overhang but left the edges flush, so the glyph's antialiasing was
    // still being nibbled: "Deepsec" rendered as ")eepsec".
    expect(gripBox.x + gripBox.width).toBeLessThanOrEqual(titleBox.x - GRIP_CLEARANCE);
  });

  test("the drag grip clears the quadrant spine", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, "Spine check !!");

    const card = page.locator("[data-testid='task-card']").filter({ hasText: "Spine check" });
    await card.hover();

    const grip = card.getByRole("button", { name: "Drag to move task" });
    await expect(grip).toBeVisible();

    const gripBox = await box(grip);
    const spineBox = await box(card.locator("[data-testid='task-card-spine']"));

    // Both anchor to the card's padding box, so `left-0` stacked them: the
    // grip's opaque fill painted over the top 24px of the spine and read as the
    // icon breaking out through the card's left edge.
    expect(gripBox.x).toBeGreaterThanOrEqual(spineBox.x + spineBox.width + GRIP_CLEARANCE);
  });

  test("every row on a card shares one left edge", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, "Aligned rows !! #infra");

    const card = page.locator("[data-testid='task-card']").filter({ hasText: "Aligned rows" });
    await card.hover();

    const title = await box(card.locator("h3"));
    const tag = await box(card.locator("[data-testid='task-tag']").first());
    const actions = await box(card.locator("[data-testid='task-card-actions']"));

    // The grip's lane was reserved by padding the title's wrapper, which its
    // sibling rows do not share — so tags and the due-date/actions row started
    // 8px to the title's left and the card read as ragged.
    expect(Math.abs(tag.x - title.x), "tag row vs title").toBeLessThanOrEqual(1);
    expect(Math.abs(actions.x - title.x), "actions row vs title").toBeLessThanOrEqual(1);
  });

  test("the mobile capture bar does not cover the last task card", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForAppLoad(page);

    for (let i = 1; i <= 6; i += 1) {
      await createTaskViaCaptureBar(page, `Mobile task ${i} !!`);
    }

    const captureBar = page.getByLabel("Capture a task");
    const lastCard = page.locator("[data-testid='task-card']").last();

    // Scroll by moving to the element rather than sleeping after a wheel event.
    await lastCard.scrollIntoViewIfNeeded();
    await expect(lastCard).toBeVisible();

    const barBox = await box(captureBar);
    const cardBox = await box(lastCard);

    // Scrolled fully down, the final card must clear the fixed bar rather than
    // sit under it.
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(barBox.y + 1);
  });

  test("the share dialog's actions stay on screen at 720px height", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, "Share me !!");

    const card = page.locator("[data-testid='task-card']").filter({ hasText: "Share me" });
    await card.hover();
    await card.getByRole("button", { name: "Share task" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Cancel anchors the action row whichever share tab is active.
    const action = dialog.getByRole("button", { name: "Cancel" });
    const actionBox = await box(action);

    // The row must be on screen without scrolling the dialog — a primary
    // action below the fold reads as a dialog with no way out.
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(720);
  });

  // The matrix goes two-up on available width, not on a viewport breakpoint.
  //
  // A viewport breakpoint cannot see the icon rail. At 768px the expanded rail
  // takes ~180px, so a md: two-column rule produced 245px panes in which every
  // task title truncated to about fifteen characters ("Escalation 1: in…").
  // Two columns nobody can read is worse than one column that works, so the
  // grid asks whether two *readable* panes fit and answers for itself.
  const MIN_PANE = 340;

  test("never renders a pane too narrow to read a task title", async ({ page }) => {
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await waitForAppLoad(page);

      for (const key of ["q1", "q2", "q3", "q4"]) {
        const pane = await box(page.locator(`[data-testid='quadrant-${key}']`));
        expect(pane.width, `${key} at ${width}px`).toBeGreaterThanOrEqual(MIN_PANE - 1);
      }
    }
  });

  test("goes two-up as soon as two readable panes fit", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForAppLoad(page);

    const q1 = await box(page.locator("[data-testid='quadrant-q1']"));
    const q2 = await box(page.locator("[data-testid='quadrant-q2']"));
    const q3 = await box(page.locator("[data-testid='quadrant-q3']"));

    // Q1 and Q2 share a row: same top, different left edge.
    expect(Math.abs(q1.y - q2.y)).toBeLessThanOrEqual(2);
    expect(q2.x).toBeGreaterThan(q1.x + q1.width - 2);

    // Q3 opens the second row beneath Q1, sharing its left edge.
    expect(q3.y).toBeGreaterThan(q1.y + q1.height - 2);
    expect(Math.abs(q3.x - q1.x)).toBeLessThanOrEqual(2);
  });

  test("stacks to one column on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForAppLoad(page);

    const q1 = await box(page.locator("[data-testid='quadrant-q1']"));
    const q2 = await box(page.locator("[data-testid='quadrant-q2']"));

    expect(Math.abs(q2.x - q1.x)).toBeLessThanOrEqual(2);
    expect(q2.y).toBeGreaterThan(q1.y + q1.height - 2);
  });
});
