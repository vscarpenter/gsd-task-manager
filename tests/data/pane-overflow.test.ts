import { describe, it, expect } from "vitest";
import { resolvePaneOverflow } from "@/lib/pane-overflow";

/**
 * A scrollable pane that is clipped by its cell looks like it simply ends.
 * The fade that says "there is more below" should appear only when there is.
 */
describe("resolvePaneOverflow", () => {
  it("reports nothing below when the content fits", () => {
    expect(resolvePaneOverflow({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 })).toBe(false);
  });

  it("reports more below when scrolled to the top of a long list", () => {
    expect(resolvePaneOverflow({ scrollTop: 0, scrollHeight: 1200, clientHeight: 400 })).toBe(true);
  });

  it("clears once the reader reaches the bottom", () => {
    expect(resolvePaneOverflow({ scrollTop: 800, scrollHeight: 1200, clientHeight: 400 })).toBe(false);
  });

  it("tolerates sub-pixel rounding at the bottom edge", () => {
    expect(resolvePaneOverflow({ scrollTop: 799.5, scrollHeight: 1200, clientHeight: 400 })).toBe(false);
  });
});
