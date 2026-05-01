import { describe, expect, it } from "vitest";
import { quadrantAccent } from "@/lib/quadrant-accent";

describe("quadrantAccent", () => {
  it("returns a CSS rgb() string referencing the q1 token at full opacity", () => {
    expect(quadrantAccent("q1")).toBe("rgb(var(--quadrant-accent-q1))");
  });

  it("returns a CSS rgb() string referencing the q2 token at full opacity", () => {
    expect(quadrantAccent("q2")).toBe("rgb(var(--quadrant-accent-q2))");
  });

  it("returns a CSS rgb() string referencing the q3 token at full opacity", () => {
    expect(quadrantAccent("q3")).toBe("rgb(var(--quadrant-accent-q3))");
  });

  it("returns a CSS rgb() string referencing the q4 token at full opacity", () => {
    expect(quadrantAccent("q4")).toBe("rgb(var(--quadrant-accent-q4))");
  });

  it("emits an alpha channel when given an alpha argument", () => {
    expect(quadrantAccent("q1", 0.1)).toBe("rgb(var(--quadrant-accent-q1) / 0.1)");
    expect(quadrantAccent("q2", 0.05)).toBe("rgb(var(--quadrant-accent-q2) / 0.05)");
  });

  it("clamps alpha to the [0, 1] range", () => {
    expect(quadrantAccent("q1", 1.5)).toBe("rgb(var(--quadrant-accent-q1) / 1)");
    expect(quadrantAccent("q1", -0.2)).toBe("rgb(var(--quadrant-accent-q1) / 0)");
  });

  it("treats an alpha of 1 as full opacity (still emits the alpha channel for explicitness)", () => {
    expect(quadrantAccent("q1", 1)).toBe("rgb(var(--quadrant-accent-q1) / 1)");
  });
});
