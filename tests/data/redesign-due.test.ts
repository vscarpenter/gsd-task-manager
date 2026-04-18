import { describe, expect, it } from "vitest";
import { dueBucket, formatDueShort, isOverdue, isSamePresetDue, presetDueDate, presetLabel } from "@/lib/redesign/due";

describe("dueBucket", () => {
  // Use local-time constructors so tests pass regardless of timezone.
  const today = new Date(2026, 3, 18, 12, 0, 0); // Apr 18, 2026 local noon

  it("returns 'none' when due date is missing or invalid", () => {
    expect(dueBucket(undefined, today)).toBe("none");
    expect(dueBucket("", today)).toBe("none");
    expect(dueBucket("not-a-date", today)).toBe("none");
  });

  it("classifies overdue dates", () => {
    expect(dueBucket(new Date(2026, 3, 17, 12, 0, 0).toISOString(), today)).toBe("overdue");
    expect(dueBucket(new Date(2020, 0, 1, 0, 0, 0).toISOString(), today)).toBe("overdue");
  });

  it("classifies today and tomorrow", () => {
    expect(dueBucket(new Date(2026, 3, 18, 0, 30, 0).toISOString(), today)).toBe("today");
    expect(dueBucket(new Date(2026, 3, 18, 23, 59, 0).toISOString(), today)).toBe("today");
    expect(dueBucket(new Date(2026, 3, 19, 8, 0, 0).toISOString(), today)).toBe("tomorrow");
  });

  it("classifies this-week, next-week, later", () => {
    expect(dueBucket(new Date(2026, 3, 24, 8).toISOString(), today)).toBe("thisweek"); // +6 days
    expect(dueBucket(new Date(2026, 3, 25, 8).toISOString(), today)).toBe("nextweek"); // +7
    expect(dueBucket(new Date(2026, 4, 2, 8).toISOString(), today)).toBe("later"); // +14
  });
});

describe("formatDueShort", () => {
  const today = new Date(2026, 3, 18, 12, 0, 0);

  it("returns null for missing due dates", () => {
    expect(formatDueShort(undefined, today)).toBeNull();
  });

  it("returns bucket labels for known buckets", () => {
    expect(formatDueShort(new Date(2026, 3, 17, 12).toISOString(), today)).toBe("Overdue");
    expect(formatDueShort(new Date(2026, 3, 18, 20).toISOString(), today)).toBe("Today");
    expect(formatDueShort(new Date(2026, 3, 19, 10).toISOString(), today)).toBe("Tomorrow");
    expect(formatDueShort(new Date(2026, 3, 25, 10).toISOString(), today)).toBe("Next week");
  });
});

describe("isOverdue", () => {
  const today = new Date(2026, 3, 18, 12, 0, 0);

  it("is false when the task is completed", () => {
    expect(
      isOverdue({ dueDate: new Date(2020, 0, 1).toISOString(), completed: true }, today)
    ).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue({ dueDate: undefined, completed: false }, today)).toBe(false);
  });

  it("is true when due date falls before today", () => {
    expect(
      isOverdue({ dueDate: new Date(2026, 3, 17, 12).toISOString(), completed: false }, today)
    ).toBe(true);
  });
});

describe("presetDueDate", () => {
  it("returns undefined for 'none'", () => {
    expect(presetDueDate("none")).toBeUndefined();
  });

  it("returns a date at 5pm local for today and tomorrow", () => {
    const today = presetDueDate("today")!;
    expect(new Date(today).getHours()).toBe(17);
    const tomorrow = presetDueDate("tomorrow")!;
    expect(new Date(tomorrow).getDate() - new Date(today).getDate()).toBe(1);
  });

  it("'thisfri' jumps to NEXT Friday when today is Friday", () => {
    // 2026-04-17 is a Friday local.
    const friday = new Date("2026-04-17T12:00:00");
    const result = presetDueDate("thisfri", friday)!;
    const diffDays = Math.round(
      (new Date(result).getTime() - friday.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  it("'thisfri' on Monday returns the coming Friday", () => {
    const monday = new Date("2026-04-13T12:00:00"); // Monday
    const result = presetDueDate("thisfri", monday)!;
    expect(new Date(result).getDay()).toBe(5);
  });
});

describe("presetLabel", () => {
  it("has a unique label for each key", () => {
    const labels = (["none", "today", "tomorrow", "thisfri", "nextweek"] as const).map(presetLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("isSamePresetDue", () => {
  it("matches 'none' when due is undefined", () => {
    expect(isSamePresetDue(undefined, "none")).toBe(true);
    expect(isSamePresetDue("2026-04-18T00:00:00Z", "none")).toBe(false);
  });

  it("matches same calendar day for preset", () => {
    const today = presetDueDate("today")!;
    expect(isSamePresetDue(today, "today")).toBe(true);
    expect(isSamePresetDue(today, "tomorrow")).toBe(false);
  });
});
