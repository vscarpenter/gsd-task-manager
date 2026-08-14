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

  test("the drag grip does not cover the title's first character", async ({ page }) => {
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
    // "QA TEST 3" rendered as "A TEST 3".
    expect(gripBox.x + gripBox.width).toBeLessThanOrEqual(titleBox.x + 1);
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

  test("the matrix keeps its 2x2 arrangement at tablet width", async ({ page }) => {
    // iPad portrait. The two-column switch used to sit at lg: (1024px), so this
    // whole viewport band — tablets, small laptops, split-screen — stacked the
    // four quadrants into one column. "The matrix is the argument" (PRODUCT.md);
    // stacked, the urgent/important relationship stops being spatial at all.
    await page.setViewportSize({ width: 768, height: 1024 });
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

  test("the matrix still stacks to one column on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForAppLoad(page);

    const q1 = await box(page.locator("[data-testid='quadrant-q1']"));
    const q2 = await box(page.locator("[data-testid='quadrant-q2']"));

    // Stacking below the tablet breakpoint is intended, not a regression.
    expect(Math.abs(q2.x - q1.x)).toBeLessThanOrEqual(2);
    expect(q2.y).toBeGreaterThan(q1.y + q1.height - 2);
  });
});
