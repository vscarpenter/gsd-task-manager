/**
 * Quieter chrome on scroll.
 *
 * The web's answer to iOS 27's auto-minimizing toolbars is behavioral: on compact
 * screens the topbar tucks away once the reader scrolls into the matrix and comes
 * straight back on any upward scroll, so the capture dock stays the hero.
 */

import { useEffect, useState } from "react";

export const SCROLL_CHROME = {
  /** How far down the page must be before chrome may hide, in pixels. */
  HIDE_AFTER: 64,
  /** Scroll movement smaller than this, in pixels, is jitter and changes nothing. */
  MIN_DELTA: 8,
  /** Widths where chrome hides. Tailwind's `md` breakpoint is 768px. */
  COMPACT_QUERY: "(max-width: 767px)",
} as const;

export interface ChromeScrollSample {
  /** Whether the chrome is hidden right now. */
  hidden: boolean;
  /** Current vertical scroll offset. */
  y: number;
  /** Vertical scroll offset at the previous sample. */
  previousY: number;
}

/** Whether the chrome should be hidden after this scroll sample. */
export function resolveChromeHidden({ hidden, y, previousY }: ChromeScrollSample): boolean {
  if (y < SCROLL_CHROME.HIDE_AFTER) return false;
  const delta = y - previousY;
  if (delta >= SCROLL_CHROME.MIN_DELTA) return true;
  if (delta <= -SCROLL_CHROME.MIN_DELTA) return false;
  return hidden;
}

/**
 * Whether the page chrome should be hidden right now.
 *
 * Inert unless `enabled`, and inert at widths above the compact query even when
 * enabled, so desktop layouts that pin the capture bar under the topbar never see
 * the topbar move. Scroll samples are throttled to one per animation frame.
 */
export function useScrollChrome(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const compact = window.matchMedia(SCROLL_CHROME.COMPACT_QUERY);
    let previousY = window.scrollY;
    let frame = 0;

    const sample = () => {
      frame = 0;
      const y = window.scrollY;
      setHidden((current) => resolveChromeHidden({ hidden: current, y, previousY }));
      previousY = y;
    };
    const onScroll = () => {
      if (!compact.matches) {
        previousY = window.scrollY;
        return;
      }
      if (!frame) frame = window.requestAnimationFrame(sample);
    };
    // Widening past the breakpoint mid-session must never strand a hidden topbar.
    const onViewportChange = () => {
      if (!compact.matches) setHidden(false);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    compact.addEventListener("change", onViewportChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      compact.removeEventListener("change", onViewportChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return enabled && hidden;
}
