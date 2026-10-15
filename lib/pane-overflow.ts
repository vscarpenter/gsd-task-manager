/**
 * Whether a scroll container has more content below the visible edge.
 *
 * A quadrant pane clipped by its grid cell looks like it simply ends, so the
 * pane shows a fade at its bottom edge only while this is true. Pure so the
 * threshold is unit-tested without layout.
 */

export interface PaneScrollSample {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Sub-pixel scroll positions round either way; anything within this is "at the bottom". */
const BOTTOM_TOLERANCE_PX = 1;

export function resolvePaneOverflow({ scrollTop, scrollHeight, clientHeight }: PaneScrollSample): boolean {
  return scrollHeight - clientHeight - scrollTop > BOTTOM_TOLERANCE_PX;
}
