import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

test.describe("Matrix and Today", () => {
  for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
    test.describe(`${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport });

      test("gives the Matrix the fold with three Today picks", async ({ page, clearIndexedDB }) => {
        void clearIndexedDB;
        const matrix = new MatrixPage(page);
        await matrix.goto();
        const titles = ["Submit revised estimate", "Review user feedback", "Confirm the venue"];
        for (const [index, title] of titles.entries()) {
          await matrix.createTask(`${title} !!`);
          const card = matrix.q1Quadrant.getByTestId("task-card").filter({ hasText: title });
          await card.hover();
          await card.getByTestId("task-card-menu").click();
          await page.getByRole("menuitem", { name: "Add to today" }).click();
          await expect(page.getByTestId("today-strip").locator("section")).toHaveAttribute("aria-label", `Today, ${index + 1} of 3`);
        }

        await page.addInitScript(() => { history.scrollRestoration = "manual"; });
        await matrix.goto();
        await page.evaluate(() => window.scrollTo(0, 0));

        if (viewport.width < 768) {
          const firstTask = await matrix.q1Quadrant.getByTestId("task-card").first().boundingBox();
          const dock = await page.getByTestId("mobile-capture-dock").boundingBox();
          expect(firstTask!.y + firstTask!.height).toBeLessThan(dock!.y);
        } else {
          const stage = await page.getByTestId("matrix-stage").boundingBox();
          for (const header of await page.getByTestId("quadrant-header").all()) {
            const box = await header.boundingBox();
            expect(box!.y + box!.height).toBeLessThanOrEqual(Math.min(viewport.height, stage!.y + stage!.height));
          }
        }

        const today = page.getByTestId("today-strip");
        const toggle = today.getByRole("button", { name: "Today", exact: true });
        const picks = today.getByRole("region", { name: "Today, 3 of 3" });
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(today.locator("time")).toBeVisible();
        const schedule = today.getByRole("button", { name: /^Schedule/ });
        await expect(schedule).toBeVisible();

        await toggle.focus();
        await toggle.press("Enter");
        await expect(picks).toBeVisible();
        await toggle.press("Space");
        await expect(toggle).toBeFocused();
        await expect(picks).toBeHidden();

        await schedule.click();
        await expect(matrix.q2Quadrant).toBeFocused();
      });
    });
  }

  test("keeps all four quadrant headers above the fold at 1440x900", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForAppLoad(page);
    await expect(page.getByRole("button", { name: "Today", exact: true })).toHaveAttribute("aria-expanded", "true");

    const headers = page.getByTestId("quadrant-header");
    await expect(headers).toHaveCount(4);

    for (let i = 0; i < 4; i += 1) {
      const box = await headers.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThan(900);
    }
  });

  test("keeps a focused Today control available as the window gets shorter", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForAppLoad(page);

    const toggle = page.getByRole("button", { name: "Today", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const suggestions = page.getByRole("button", { name: "Pick up to three for today" });
    await suggestions.focus();
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(suggestions).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("does not scroll the page sideways on a phone", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    await page.setViewportSize({ width: 320, height: 640 });
    await waitForAppLoad(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("labels the axes only where the panes form a 2x2", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForAppLoad(page);
    await expect(page.getByTestId("matrix-axis-columns")).toBeVisible();
    await expect(page.getByTestId("matrix-axis-rows")).toBeVisible();

    // Below the container width that yields two columns the stack has no axes.
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(page.getByTestId("matrix-axis-columns")).toBeHidden();
    await expect(page.getByTestId("matrix-axis-rows")).toBeHidden();
  });
});
