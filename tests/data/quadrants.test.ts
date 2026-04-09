import { describe, expect, it } from "vitest";
import {
  resolveQuadrantId,
  parseQuadrantFlags,
  quadrants,
  quadrantOrder,
} from "@/lib/quadrants";
import type { QuadrantId } from "@/lib/types";

describe("resolveQuadrantId", () => {
  it("should_return_urgent_important_when_both_flags_true", () => {
    expect(resolveQuadrantId(true, true)).toBe("urgent-important");
  });

  it("should_return_not_urgent_important_when_only_important", () => {
    expect(resolveQuadrantId(false, true)).toBe("not-urgent-important");
  });

  it("should_return_urgent_not_important_when_only_urgent", () => {
    expect(resolveQuadrantId(true, false)).toBe("urgent-not-important");
  });

  it("should_return_not_urgent_not_important_when_both_flags_false", () => {
    expect(resolveQuadrantId(false, false)).toBe("not-urgent-not-important");
  });
});

describe("parseQuadrantFlags", () => {
  it("should_return_both_true_for_urgent_important", () => {
    const flags = parseQuadrantFlags("urgent-important");
    expect(flags).toEqual({ urgent: true, important: true });
  });

  it("should_return_urgent_false_important_true_for_not_urgent_important", () => {
    const flags = parseQuadrantFlags("not-urgent-important");
    expect(flags).toEqual({ urgent: false, important: true });
  });

  it("should_return_urgent_true_important_false_for_urgent_not_important", () => {
    const flags = parseQuadrantFlags("urgent-not-important");
    expect(flags).toEqual({ urgent: true, important: false });
  });

  it("should_return_both_false_for_not_urgent_not_important", () => {
    const flags = parseQuadrantFlags("not-urgent-not-important");
    expect(flags).toEqual({ urgent: false, important: false });
  });

  it("should_be_the_inverse_of_resolveQuadrantId_for_all_quadrants", () => {
    const allQuadrantIds: QuadrantId[] = [
      "urgent-important",
      "not-urgent-important",
      "urgent-not-important",
      "not-urgent-not-important",
    ];

    for (const quadrantId of allQuadrantIds) {
      const { urgent, important } = parseQuadrantFlags(quadrantId);
      expect(resolveQuadrantId(urgent, important)).toBe(quadrantId);
    }
  });
});

describe("quadrants array", () => {
  it("should_have_exactly_4_entries", () => {
    expect(quadrants).toHaveLength(4);
  });

  it("should_contain_all_four_quadrant_ids", () => {
    const ids = quadrants.map((q) => q.id);
    expect(ids).toContain("urgent-important");
    expect(ids).toContain("not-urgent-important");
    expect(ids).toContain("urgent-not-important");
    expect(ids).toContain("not-urgent-not-important");
  });

  it("should_have_unique_ids", () => {
    const ids = quadrants.map((q) => q.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("should_have_title_and_subtitle_for_each_entry", () => {
    for (const quadrant of quadrants) {
      expect(quadrant.title).toBeTruthy();
      expect(quadrant.subtitle).toBeTruthy();
    }
  });

  it("should_have_correct_titles_for_each_quadrant", () => {
    const titleMap = new Map(quadrants.map((q) => [q.id, q.title]));
    expect(titleMap.get("urgent-important")).toBe("Do First");
    expect(titleMap.get("not-urgent-important")).toBe("Schedule");
    expect(titleMap.get("urgent-not-important")).toBe("Delegate");
    expect(titleMap.get("not-urgent-not-important")).toBe("Eliminate");
  });
});

describe("quadrantOrder", () => {
  it("should_have_exactly_4_entries", () => {
    expect(quadrantOrder).toHaveLength(4);
  });

  it("should_match_the_order_of_the_quadrants_array", () => {
    const expectedOrder = quadrants.map((q) => q.id);
    expect(quadrantOrder).toEqual(expectedOrder);
  });

  it("should_contain_all_four_quadrant_ids", () => {
    expect(quadrantOrder).toContain("urgent-important");
    expect(quadrantOrder).toContain("not-urgent-important");
    expect(quadrantOrder).toContain("urgent-not-important");
    expect(quadrantOrder).toContain("not-urgent-not-important");
  });
});
