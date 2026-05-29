import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCountUp } from "@/lib/use-count-up";

// Migrated from the former tests/data/functions-branches-boost.test.ts
// "useCountUp" block (finding F2.1) — this is the module's only test file.
//
// Note: the requestAnimationFrame animation loop in useCountUp is intentionally
// skipped when NODE_ENV === "test" (the hook returns the target immediately), so
// that branch is structurally unreachable here. Coverage of lib/use-count-up.ts
// is therefore capped (~66% functions / ~65% branches) by design, not by a test gap.

describe("useCountUp", () => {
  it("returns the numeric target immediately in the test env (animation skipped)", () => {
    const { result } = renderHook(() => useCountUp(42));
    expect(result.current).toBe("42");
  });

  it("preserves the suffix on a string target", () => {
    const { result } = renderHook(() => useCountUp("85%"));
    expect(result.current).toBe("85%");
  });

  it("handles a zero target", () => {
    const { result } = renderHook(() => useCountUp(0));
    expect(result.current).toBe("0");
  });

  it("returns the original string for non-numeric input", () => {
    const { result } = renderHook(() => useCountUp("N/A"));
    expect(result.current).toBe("N/A");
  });

  it("returns 'NaN' for NaN input (treated as non-numeric)", () => {
    const { result } = renderHook(() => useCountUp(NaN));
    expect(result.current).toBe("NaN");
  });

  it("returns 'Infinity' for non-finite input (treated as non-numeric)", () => {
    const { result } = renderHook(() => useCountUp(Infinity));
    expect(result.current).toBe("Infinity");
  });
});
