import { describe, it, expect, afterEach } from "vitest";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

// The predicate guards every JS-driven animation in the app. CSS animations are
// covered by the `prefers-reduced-motion: reduce` block in app/globals.css, but
// anything running on requestAnimationFrame is invisible to that stylesheet and
// has to ask this question itself.

const original = window.matchMedia;

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = original;
});

describe("prefersReducedMotion", () => {
  it("returns true when the user has asked for reduced motion", () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when the user has not asked for reduced motion", () => {
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("queries the reduce preference specifically", () => {
    let asked = "";
    window.matchMedia = ((query: string) => {
      asked = query;
      return { matches: false } as MediaQueryList;
    }) as typeof window.matchMedia;
    prefersReducedMotion();
    expect(asked).toBe("(prefers-reduced-motion: reduce)");
  });

  it("returns false rather than throwing when matchMedia is unavailable", () => {
    // Older Safari and some embedded webviews ship without matchMedia. Motion
    // is the safe default there: the user never expressed a preference.
    Reflect.deleteProperty(window, "matchMedia");
    expect(prefersReducedMotion()).toBe(false);
  });
});
