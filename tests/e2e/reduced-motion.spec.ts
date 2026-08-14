import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * The reduced-motion contract, measured rather than assumed.
 *
 * PRODUCT.md promises every animation has a `prefers-reduced-motion: reduce`
 * fallback. The subtlety the audit found is that "fallback" is not the same as
 * "off": a blanket kill switch satisfies the letter of the preference while
 * deleting feedback the user still needs. A frozen spinner does not read as
 * "motion respectfully removed", it reads as "the app has hung".
 */
test.describe("Reduced motion", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("keeps progress indicators turning while killing decorative motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await waitForAppLoad(page);

    // Probe the stylesheet directly. A real spinner only exists during a
    // transient loading state, which is not something to race a test against.
    const computed = await page.evaluate(() => {
      const spinner = document.createElement("div");
      spinner.className = "animate-spin";
      const decorative = document.createElement("div");
      decorative.className = "transition-colors";
      document.body.append(spinner, decorative);

      const s = getComputedStyle(spinner);
      const d = getComputedStyle(decorative);
      const result = {
        spinIterations: s.animationIterationCount,
        spinDurationMs: parseFloat(s.animationDuration) * (s.animationDuration.endsWith("ms") ? 1 : 1000),
        decorativeDurationMs: parseFloat(d.transitionDuration) * (d.transitionDuration.endsWith("ms") ? 1 : 1000),
      };
      spinner.remove();
      decorative.remove();
      return result;
    });

    // `animation-iteration-count: 1 !important` in the blanket reset clamped
    // `animate-spin` to a single 0.01ms revolution — a static ring with a gap
    // in it. Assistive tech still heard "Loading"; sighted users who prefer
    // reduced motion saw a stalled app.
    expect(computed.spinIterations).toBe("infinite");
    expect(computed.spinDurationMs).toBeGreaterThan(100);

    // The rest of the reset must survive: decorative transitions stay killed.
    expect(computed.decorativeDurationMs).toBeLessThan(1);
  });

  test("still animates normally when no preference is expressed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await waitForAppLoad(page);

    const durationMs = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "transition-colors";
      document.body.append(el);
      const value = getComputedStyle(el).transitionDuration;
      el.remove();
      return parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
    });

    // Guards against a fix that quietly disables motion for everyone.
    expect(durationMs).toBeGreaterThan(1);
  });
});
