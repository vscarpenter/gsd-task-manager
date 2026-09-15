/**
 * Swipe-action gesture math for task cards.
 *
 * The rules match `gsd-iosapp/App/Matrix/SwipeRevealRow.swift` so a user moving
 * between phone and browser meets one vocabulary: leading swipe reveals one button
 * and commits it on a full swipe, trailing swipe reveals two and is tap only.
 */

import { SWIPE_CONFIG } from "@/lib/constants";

export type SwipeDirection = "undecided" | "horizontal" | "vertical";

export type SwipeOutcome = "commit-leading" | "open-leading" | "open-trailing" | "close";

/** Pixels revealed by an open leading edge: one button. */
export const LEADING_REVEAL = SWIPE_CONFIG.BUTTON_WIDTH;

/** Pixels revealed by an open trailing edge: two buttons. */
export const TRAILING_REVEAL = SWIPE_CONFIG.BUTTON_WIDTH * 2;

/**
 * Which axis a drag belongs to once it has travelled the lock distance. Ties go
 * to the scroller, so a diagonal thumb never steals a page scroll.
 */
export function lockDirection({ dx, dy }: { dx: number; dy: number }): SwipeDirection {
  const alongX = Math.abs(dx);
  const alongY = Math.abs(dy);
  if (alongX < SWIPE_CONFIG.DIRECTION_LOCK_PX && alongY < SWIPE_CONFIG.DIRECTION_LOCK_PX) {
    return "undecided";
  }
  return alongX > alongY ? "horizontal" : "vertical";
}

/** The card offset for a drag of `dx`: free to the row's width rightward, capped leftward. */
export function clampSwipeOffset(dx: number, rowWidth: number): number {
  return dx > 0 ? Math.min(dx, rowWidth) : Math.max(dx, -TRAILING_REVEAL);
}

/** What happens when the finger lifts after a drag of `dx`. */
export function resolveSwipeEnd(dx: number, rowWidth: number): SwipeOutcome {
  if (dx > rowWidth * SWIPE_CONFIG.FULL_SWIPE_FRACTION) return "commit-leading";
  if (dx > LEADING_REVEAL * SWIPE_CONFIG.OPEN_FRACTION) return "open-leading";
  if (dx < -TRAILING_REVEAL * SWIPE_CONFIG.OPEN_FRACTION) return "open-trailing";
  return "close";
}
