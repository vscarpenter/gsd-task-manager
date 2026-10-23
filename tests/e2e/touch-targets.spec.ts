import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * The coarse-pointer target floor, measured on a touch context.
 *
 * DESIGN.md §5: "Controls are 38px tall on pointer devices and expand to at
 * least 44px on coarse pointers." That expansion used to be opt-in — it only
 * reached elements a developer remembered to mark with `.touch-target`, so any
 * control that forgot the class shipped at desktop size on a phone. These
 * specs pin the floor to the base component classes instead, where forgetting
 * is not possible.
 */
test.use({ hasTouch: true });

const PROBE_MARKUP = `
  <div id="tt-probe" style="position:fixed;top:120px;left:120px;z-index:99999;
       background:var(--paper);padding:40px;display:flex;flex-direction:column;gap:40px;">
    <button class="btn btn-primary" id="tt-btn">Button</button>
    <input class="input" id="tt-input" />
    <label class="checkbox"><input type="checkbox" id="tt-checkbox" /><span>Check</span></label>
    <label class="radio"><input type="radio" id="tt-radio" /><span>Radio</span></label>
    <label class="switch"><input type="checkbox" id="tt-switch" /><span>Switch</span></label>
  </div>
`;

test.describe("Coarse-pointer target floor", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("the media query actually matches on a touch context", async ({ page }) => {
    await waitForAppLoad(page);
    const coarse = await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches);
    // If this ever goes false the rest of the file silently tests nothing.
    expect(coarse).toBe(true);
  });

  test("sized controls meet the 44px height floor", async ({ page }) => {
    await waitForAppLoad(page);
    await page.evaluate((markup) => {
      document.body.insertAdjacentHTML("beforeend", markup);
    }, PROBE_MARKUP);

    for (const id of ["tt-btn", "tt-input"]) {
      const rect = await page.locator(`#${id}`).boundingBox();
      expect(rect, `#${id} has no box`).not.toBeNull();
      expect(rect!.height, `#${id} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test("small controls reach 44px without growing visually", async ({ page }) => {
    await waitForAppLoad(page);
    await page.evaluate((markup) => {
      document.body.insertAdjacentHTML("beforeend", markup);
    }, PROBE_MARKUP);

    for (const id of ["tt-checkbox", "tt-radio", "tt-switch"]) {
      const result = await page.evaluate((elementId) => {
        const el = document.getElementById(elementId)!;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // 21px from centre is inside a 44px target and outside an 18px one.
        // elementFromPoint resolves a pseudo-element to its originating
        // element, so this measures the real tap reach rather than the
        // declared box.
        const hit = (dx: number, dy: number) =>
          document.elementFromPoint(cx + dx, cy + dy) === el;
        return {
          visualWidth: r.width,
          visualHeight: r.height,
          up: hit(0, -21),
          down: hit(0, 21),
          left: hit(-21, 0),
          right: hit(21, 0),
        };
      }, id);

      expect(result.up, `#${id} reach up`).toBe(true);
      expect(result.down, `#${id} reach down`).toBe(true);
      expect(result.left, `#${id} reach left`).toBe(true);
      expect(result.right, `#${id} reach right`).toBe(true);

      // The point of expanding the hit area with a pseudo-element rather than
      // min-width/min-height is that Editorial's compact control shapes
      // survive. A 44px checkbox would be a different design.
      expect(result.visualHeight, `#${id} visual height`).toBeLessThan(30);
    }
  });

  test("text fields are at least 16px on a touch screen, so iOS Safari does not zoom", async ({ page }) => {
    // Safari on iPhone zooms the page into any focused field set under 16px.
    const typedFields = "input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select";
    await waitForAppLoad(page);
    // Touch hides the card's hover actions, so open the drawer as the composer.
    // Its button appears once the capture bar holds text to hand off.
    await page.getByTestId("capture-input").fill("Field sizes");
    await page.getByTestId("more-options").click();
    await expect(page.getByTestId("edit-drawer")).toBeVisible();

    const drawerFields = await page.getByTestId("edit-drawer").evaluate(
      (drawer, selector) =>
        [...drawer.querySelectorAll<HTMLElement>(selector)]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .map((el) => ({
            name: el.getAttribute("aria-label") ?? el.getAttribute("data-testid") ?? el.tagName,
            size: parseFloat(getComputedStyle(el).fontSize),
          })),
      typedFields
    );
    expect(drawerFields.length).toBeGreaterThan(0);
    for (const field of drawerFields) expect(field.size, field.name).toBeGreaterThanOrEqual(16);

    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByPlaceholder("Search tasks, actions, settings...");
    await expect(search).toBeVisible();
    const searchSize = await search.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(searchSize, "command palette search").toBeGreaterThanOrEqual(16);
  });

  test("the app's settings switch reaches 44px without growing visually", async ({ page }) => {
    await waitForAppLoad(page);
    await page.goto("/settings");

    // The React Switch is a Radix button, not the .switch input above, so it
    // needs the same pseudo-element reach of its own.
    const toggle = page.getByRole("switch", { name: "Show completed" });
    await expect(toggle).toBeVisible();

    const result = await toggle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = (dx: number, dy: number) => document.elementFromPoint(cx + dx, cy + dy) === el;
      return { visualHeight: r.height, up: hit(0, -21), down: hit(0, 21), left: hit(-21, 0), right: hit(21, 0) };
    });

    expect(result.up, "reach up").toBe(true);
    expect(result.down, "reach down").toBe(true);
    expect(result.left, "reach left").toBe(true);
    expect(result.right, "reach right").toBe(true);
    expect(result.visualHeight, "visual height").toBeLessThan(30);
  });
});
