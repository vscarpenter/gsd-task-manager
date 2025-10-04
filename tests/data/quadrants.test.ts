import { describe, expect, it } from "vitest";
import { resolveQuadrantId } from "@/lib/quadrants";

describe("resolveQuadrantId", () => {
  it("maps urgent important to do first", () => {
    expect(resolveQuadrantId(true, true)).toBe("urgent-important");
  });

  it("maps not urgent but important to schedule", () => {
    expect(resolveQuadrantId(false, true)).toBe("not-urgent-important");
  });

  it("maps urgent not important to delegate", () => {
    expect(resolveQuadrantId(true, false)).toBe("urgent-not-important");
  });

  it("maps calm trivial work to eliminate", () => {
    expect(resolveQuadrantId(false, false)).toBe("not-urgent-not-important");
  });
});
