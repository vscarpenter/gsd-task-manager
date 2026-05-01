import type { RedesignQuadrantKey } from "@/lib/quadrants";

/**
 * Single source of truth for quadrant accent colors.
 *
 * Why: three components (capture-bar, quadrant-pane, edit-drawer) used to keep their own
 * `ACCENT` map of hex literals. That made every palette change a four-edit job and gave
 * future contributors a fourth place to drift to. This helper resolves the accent from
 * a CSS custom property so both light and dark themes — and any future palette swap —
 * cascade automatically.
 *
 * Token names are defined in `app/globals.css` as `--quadrant-accent-{q1..q4}`.
 */
export function quadrantAccent(key: RedesignQuadrantKey, alpha?: number): string {
  const triple = `var(--quadrant-accent-${key})`;
  if (alpha === undefined) return `rgb(${triple})`;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgb(${triple} / ${clamped})`;
}
