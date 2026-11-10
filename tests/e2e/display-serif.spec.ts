import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { createTaskViaCaptureBar, waitForAppLoad } from "./helpers/test-helpers";

/**
 * Newsreader ships as Google's three subset files (latin, latin-ext, and
 * vietnamese), each with its own unicode-range (app/layout.tsx). A task title
 * with Polish and Vietnamese letters must paint every letter as one Newsreader
 * glyph. Without the ranges, the latin file draws Ź and ở as a base letter plus
 * a separate accent, two glyphs each. If a file stops joining the family, its
 * letters fall back to a system serif. Only Chromium reports the fonts that
 * painted a node.
 */
const TITLE = "Źródło phở";
const TITLE_SELECTOR = "[data-testid='task-detail-sheet'] h2";

type PaintedFonts = { families: string[]; allWebFonts: boolean; glyphs: number };

async function paintedFonts(page: Page, selector: string): Promise<PaintedFonts> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return {
      families: fonts.map((font) => font.familyName),
      allWebFonts: fonts.every((font) => font.isCustomFont),
      glyphs: fonts.reduce((total, font) => total + font.glyphCount, 0),
    };
  } finally {
    await cdp.detach();
  }
}

test.describe("Display serif", () => {
  test.beforeEach(async ({ browserName, clearIndexedDB }) => {
    test.skip(browserName !== "chromium", "only Chromium reports the fonts that painted a node");
  });

  test("paints a Polish and Vietnamese task title one Newsreader glyph per letter", async ({ page }) => {
    await waitForAppLoad(page);
    await createTaskViaCaptureBar(page, TITLE);
    await page.getByRole("button", { name: `View details for ${TITLE}` }).click();
    await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();

    // The latin-ext and vietnamese files download only once a letter needs them.
    await expect
      .poll(() => paintedFonts(page, TITLE_SELECTOR))
      .toEqual({
        families: [expect.stringMatching(/^Newsreader/)],
        allWebFonts: true,
        glyphs: [...TITLE].length,
      });
  });
});
