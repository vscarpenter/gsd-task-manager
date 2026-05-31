"use client";

import * as React from "react";

/** Gap between pills, in px. Must match the Tailwind `gap-2` on the strip rows. */
const GAP_PX = 8;

export interface VisibleCountParams {
  /** Natural width (px) of each overflow-eligible view pill, in order. */
  viewWidths: number[];
  /** Width (px) of the pinned "All tasks" pill, which is always shown inline. */
  leadWidth: number;
  /** Width (px) of the "More" button, reserved only when the row overflows. */
  moreWidth: number;
  /** Available width (px) of the strip container. */
  available: number;
  /** Gap (px) between pills. */
  gap: number;
}

/**
 * Greedily decide how many view pills fit inline before the rest must collapse
 * into the "More" menu. Pure and synchronous so it is fully unit-testable; the
 * hook below supplies the measured widths.
 */
export function computeVisibleViewCount({
  viewWidths,
  leadWidth,
  moreWidth,
  available,
  gap,
}: VisibleCountParams): number {
  // Does the whole row fit without needing a More button at all?
  let full = leadWidth;
  for (const w of viewWidths) full += gap + w;
  if (full <= available) return viewWidths.length;

  // Overflowing: reserve room for the More button *and* the gap that sits
  // between it and the last inline pill, then fit pills greedily.
  const budget = available - moreWidth - gap;
  let used = leadWidth;
  let count = 0;
  for (const w of viewWidths) {
    used += gap + w;
    if (used > budget) break;
    count += 1;
  }
  return count;
}

export interface SmartViewOverflow {
  /** Attach to the strip wrapper; its clientWidth is the available space. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the hidden measurement row: [lead, ...views, more]. */
  ghostRef: React.RefObject<HTMLDivElement | null>;
  /** How many view pills to render inline; the rest go in the More menu. */
  visibleCount: number;
}

/**
 * Measure available space against a hidden ghost row and report how many view
 * pills fit inline. The ghost renders every pill at natural width, so the
 * measurement is stable regardless of the current inline/overflow split — no
 * feedback loop. Recomputes on mount and whenever the container resizes.
 */
export function useSmartViewOverflow(viewCount: number): SmartViewOverflow {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const ghostRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(viewCount);

  // useLayoutEffect (not useEffect) so the measured split is applied before
  // first paint — otherwise the row flashes the pre-measurement state. Safe
  // because this app is client-only (no SSR).
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const ghost = ghostRef.current;
    if (!container || !ghost) return;

    const measure = () => {
      // No measurable width yet (initial layout, hidden ancestor, or a
      // no-layout environment like jsdom): show every pill inline rather than
      // collapsing them all into the menu. A real width arrives via the
      // observer and corrects this before the user can interact.
      const available = container.clientWidth;
      if (available <= 0) {
        setVisibleCount(viewCount);
        return;
      }
      // Ghost children are rendered in a fixed order: [lead, ...views, more].
      const children = Array.from(ghost.children) as HTMLElement[];
      if (children.length !== viewCount + 2) return;
      const leadWidth = children[0].offsetWidth;
      const moreWidth = children[children.length - 1].offsetWidth;
      const viewWidths = children.slice(1, -1).map((el) => el.offsetWidth);
      setVisibleCount(
        computeVisibleViewCount({ viewWidths, leadWidth, moreWidth, available, gap: GAP_PX })
      );
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewCount]);

  return { containerRef, ghostRef, visibleCount };
}
