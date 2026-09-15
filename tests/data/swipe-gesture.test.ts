/**
 * The swipe gesture math, kept pure so the card component stays about wiring.
 *
 * Mirrors `gsd-iosapp/App/Matrix/SwipeRevealRow.swift`: a 12px directional lock,
 * one 84px button on the leading edge with full-swipe-to-complete, two on the
 * trailing edge with tap only, and a 60 percent snap threshold.
 */
import { describe, expect, it } from "vitest";
import { SWIPE_CONFIG } from "@/lib/constants";
import { clampSwipeOffset, lockDirection, resolveSwipeEnd } from "@/lib/swipe-gesture";

const { DIRECTION_LOCK_PX, BUTTON_WIDTH, OPEN_FRACTION, FULL_SWIPE_FRACTION } = SWIPE_CONFIG;
const LEADING_REVEAL = BUTTON_WIDTH;
const TRAILING_REVEAL = BUTTON_WIDTH * 2;
const ROW_WIDTH = 340;

describe("lockDirection", () => {
  it("stays undecided until the pointer has travelled the lock distance", () => {
    expect(lockDirection({ dx: DIRECTION_LOCK_PX - 1, dy: 0 })).toBe("undecided");
    expect(lockDirection({ dx: 0, dy: DIRECTION_LOCK_PX - 1 })).toBe("undecided");
  });

  it("claims a horizontal-dominant drag", () => {
    expect(lockDirection({ dx: DIRECTION_LOCK_PX, dy: 4 })).toBe("horizontal");
    expect(lockDirection({ dx: -DIRECTION_LOCK_PX, dy: 4 })).toBe("horizontal");
  });

  it("releases a vertical-dominant drag to the scroller", () => {
    expect(lockDirection({ dx: 4, dy: DIRECTION_LOCK_PX })).toBe("vertical");
    expect(lockDirection({ dx: DIRECTION_LOCK_PX, dy: DIRECTION_LOCK_PX })).toBe("vertical");
  });
});

describe("clampSwipeOffset", () => {
  it("lets a rightward swipe run the full row so a full swipe can fill it", () => {
    expect(clampSwipeOffset(ROW_WIDTH + 50, ROW_WIDTH)).toBe(ROW_WIDTH);
    expect(clampSwipeOffset(120, ROW_WIDTH)).toBe(120);
  });

  it("stops a leftward swipe at the two trailing buttons", () => {
    expect(clampSwipeOffset(-500, ROW_WIDTH)).toBe(-TRAILING_REVEAL);
    expect(clampSwipeOffset(-40, ROW_WIDTH)).toBe(-40);
  });
});

describe("resolveSwipeEnd", () => {
  it("commits the leading action on a full swipe past half the row", () => {
    expect(resolveSwipeEnd(ROW_WIDTH * FULL_SWIPE_FRACTION + 1, ROW_WIDTH)).toBe("commit-leading");
  });

  it("snaps open to the leading button past the open threshold", () => {
    expect(resolveSwipeEnd(LEADING_REVEAL * OPEN_FRACTION + 1, ROW_WIDTH)).toBe("open-leading");
  });

  it("snaps open to the trailing buttons past the open threshold", () => {
    expect(resolveSwipeEnd(-(TRAILING_REVEAL * OPEN_FRACTION + 1), ROW_WIDTH)).toBe("open-trailing");
  });

  it("closes on anything shorter in either direction", () => {
    expect(resolveSwipeEnd(LEADING_REVEAL * OPEN_FRACTION - 1, ROW_WIDTH)).toBe("close");
    expect(resolveSwipeEnd(-(TRAILING_REVEAL * OPEN_FRACTION - 1), ROW_WIDTH)).toBe("close");
    expect(resolveSwipeEnd(0, ROW_WIDTH)).toBe("close");
  });

  it("never commits on the trailing edge, however far the swipe goes", () => {
    expect(resolveSwipeEnd(-ROW_WIDTH, ROW_WIDTH)).toBe("open-trailing");
  });
});
