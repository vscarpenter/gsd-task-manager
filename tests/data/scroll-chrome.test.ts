/**
 * The scroll-chrome decision: when the topbar tucks away and when it returns.
 *
 * The rule mirrors what iOS 27 does with auto-minimizing toolbars, expressed for a
 * scrolling page: chrome hides on a downward scroll once the reader is clearly into
 * the list, and any upward scroll brings it straight back. Pure, so the hook that
 * wires it to the window stays thin.
 */
import { describe, expect, it } from "vitest";
import { resolveChromeHidden, SCROLL_CHROME } from "@/lib/use-scroll-chrome";

const { HIDE_AFTER, MIN_DELTA } = SCROLL_CHROME;

describe("resolveChromeHidden", () => {
  it("stays visible at the top of the page", () => {
    expect(resolveChromeHidden({ hidden: false, y: 0, previousY: 0 })).toBe(false);
  });

  it("stays visible while the page is still near the top", () => {
    expect(
      resolveChromeHidden({ hidden: false, y: HIDE_AFTER - 1, previousY: 0 })
    ).toBe(false);
  });

  it("hides on a downward scroll past the threshold", () => {
    expect(
      resolveChromeHidden({ hidden: false, y: HIDE_AFTER + MIN_DELTA, previousY: HIDE_AFTER })
    ).toBe(true);
  });

  it("ignores jitter smaller than the minimum delta", () => {
    expect(
      resolveChromeHidden({ hidden: false, y: HIDE_AFTER + MIN_DELTA, previousY: HIDE_AFTER + 1 })
    ).toBe(false);
    expect(
      resolveChromeHidden({ hidden: true, y: HIDE_AFTER + 20, previousY: HIDE_AFTER + 21 })
    ).toBe(true);
  });

  it("returns on any upward scroll that clears the minimum delta", () => {
    expect(
      resolveChromeHidden({ hidden: true, y: 400, previousY: 400 + MIN_DELTA })
    ).toBe(false);
  });

  it("returns when the page is back at the top, whatever the delta", () => {
    expect(resolveChromeHidden({ hidden: true, y: 0, previousY: 2 })).toBe(false);
  });

  it("treats overscroll bounce as the top of the page", () => {
    expect(resolveChromeHidden({ hidden: true, y: -30, previousY: -10 })).toBe(false);
  });

  it("keeps hidden chrome hidden while scrolling further down", () => {
    expect(resolveChromeHidden({ hidden: true, y: 900, previousY: 800 })).toBe(true);
  });
});
