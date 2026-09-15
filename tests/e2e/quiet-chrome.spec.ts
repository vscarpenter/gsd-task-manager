import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Quieter chrome on scroll, measured in a real browser.
 *
 * Below 768px the matrix topbar slides off the top edge on scroll-down and
 * returns on scroll-up, so the capture dock stays the hero. Desktop widths pin
 * the capture bar under the topbar and must never see it move. jsdom cannot
 * evaluate the media query or lay out a sticky bar, so this is where the
 * geometry is pinned.
 */

/** Enough rows that the board scrolls well past the hide threshold on a phone. */
async function seedTasks(page: Page, count: number): Promise<void> {
  await page.evaluate((total) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("GsdTaskManager");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("tasks", "readwrite");
        const store = tx.objectStore("tasks");
        const now = new Date().toISOString();
        for (let index = 0; index < total; index += 1) {
          const urgent = index % 2 === 0;
          const important = index % 4 < 2;
          store.add({
            id: `quiet-chrome-${index}`,
            title: `Scroll fodder ${index + 1}`,
            description: "",
            urgent,
            important,
            quadrant: `${urgent ? "urgent" : "not-urgent"}-${important ? "important" : "not-important"}`,
            completed: false,
            createdAt: now,
            updatedAt: now,
            recurrence: "none",
            tags: [],
            subtasks: [],
            dependencies: [],
            notificationEnabled: false,
            notificationSent: false,
            timeSpent: 0,
            timeEntries: [],
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      req.onerror = () => reject(req.error);
    });
  }, count);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppLoad(page);
}

async function bottomEdge(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("topbar has no box");
  return box.y + box.height;
}

test.describe("Quiet chrome on scroll", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test.describe("on a phone-width viewport", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("tucks the topbar away on scroll-down and brings it back on scroll-up", async ({ page }) => {
      await waitForAppLoad(page);
      await seedTasks(page, 24);
      const topbar = page.getByRole("banner");
      await expect(topbar).not.toHaveAttribute("data-chrome-hidden", "true");
      expect(await bottomEdge(topbar)).toBeGreaterThan(0);

      await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
      await expect(topbar).toHaveAttribute("data-chrome-hidden", "true");
      // Off the top edge, not merely flagged: the bar's bottom sits at or above y=0.
      await expect.poll(() => bottomEdge(topbar)).toBeLessThanOrEqual(0.5);

      await page.evaluate(() => window.scrollBy({ top: -120, behavior: "instant" }));
      await expect(topbar).not.toHaveAttribute("data-chrome-hidden", "true");
      await expect.poll(() => bottomEdge(topbar)).toBeGreaterThan(40);
    });

    test("keeps the bar visible while the page is near the top", async ({ page }) => {
      await waitForAppLoad(page);
      await seedTasks(page, 24);
      const topbar = page.getByRole("banner");

      await page.evaluate(() => window.scrollTo({ top: 40, behavior: "instant" }));
      // Give any pending frame a chance to run; the bar must still be up.
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
      await expect(topbar).not.toHaveAttribute("data-chrome-hidden", "true");
    });
  });

  test.describe("on a desktop viewport", () => {
    test("never moves the topbar, so the sticky capture bar stays pinned under it", async ({ page }) => {
      await waitForAppLoad(page);
      await seedTasks(page, 24);
      const topbar = page.getByRole("banner");
      const captureBar = page.getByTestId("capture-bar");
      const restingEdge = await bottomEdge(topbar);

      await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
      await expect(topbar).not.toHaveAttribute("data-chrome-hidden", "true");
      expect(await bottomEdge(topbar)).toBeCloseTo(restingEdge, 0);
      const captureBox = await captureBar.boundingBox();
      expect(captureBox).not.toBeNull();
      expect(captureBox!.y).toBeGreaterThanOrEqual(restingEdge - 1);
    });
  });
});
