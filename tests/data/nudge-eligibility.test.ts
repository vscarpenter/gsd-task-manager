import { describe, it, expect } from "vitest";
import { subDays, subHours } from "date-fns";
import { createMockTask } from "@/tests/fixtures";
import {
  summarizeEngagement,
  shouldShowFeedbackNudge,
  type EngagementSummary,
} from "@/lib/feedback/nudge-eligibility";
import type { TaskRecord } from "@/lib/types";

const NOW = new Date("2026-09-02T12:00:00.000Z");

function daysAgo(days: number): string {
  return subDays(NOW, days).toISOString();
}

/** A task created the day before it was completed, both `days` ago. */
function completedTask(id: string, days: number, overrides?: Partial<TaskRecord>): TaskRecord {
  return createMockTask({
    id,
    completed: true,
    createdAt: daysAgo(days + 1),
    completedAt: daysAgo(days),
    updatedAt: daysAgo(days),
    ...overrides,
  });
}

describe("summarizeEngagement", () => {
  it("reports nothing for an empty board", () => {
    expect(summarizeEngagement([], NOW)).toEqual({
      tenureDays: 0,
      completions: 0,
      completionDays: 0,
    });
  });

  it("measures tenure in whole days from the oldest task, whatever its state", () => {
    const tasks = [
      createMockTask({ id: "new", createdAt: daysAgo(1), updatedAt: daysAgo(1) }),
      createMockTask({ id: "old", createdAt: subHours(NOW, 20 * 24 + 12).toISOString() }),
    ];

    expect(summarizeEngagement(tasks, NOW).tenureDays).toBe(20);
  });

  it("counts only completed tasks", () => {
    const tasks = [
      completedTask("a", 3),
      completedTask("b", 2),
      createMockTask({ id: "open", completed: false }),
    ];

    expect(summarizeEngagement(tasks, NOW).completions).toBe(2);
  });

  it("dedupes completions that landed on the same day", () => {
    const tasks = [completedTask("a", 3), completedTask("b", 3), completedTask("c", 1)];

    expect(summarizeEngagement(tasks, NOW).completionDays).toBe(2);
  });

  it("falls back to updatedAt when a legacy record has no completedAt", () => {
    const legacy = completedTask("legacy", 5, { completedAt: undefined });

    expect(summarizeEngagement([legacy], NOW).completionDays).toBe(1);
  });
});

describe("shouldShowFeedbackNudge", () => {
  const returning: EngagementSummary = { tenureDays: 20, completions: 12, completionDays: 4 };
  const quiet = { lastSentAt: null, dismissedAt: null, hasDraft: false, now: NOW };

  it("shows for a returning user who has never been asked", () => {
    expect(shouldShowFeedbackNudge({ engagement: returning, ...quiet })).toBe(true);
  });

  it("shows exactly at the thresholds", () => {
    const atFloor: EngagementSummary = { tenureDays: 14, completions: 10, completionDays: 3 };

    expect(shouldShowFeedbackNudge({ engagement: atFloor, ...quiet })).toBe(true);
  });

  it.each([
    ["tenure under 14 days", { tenureDays: 13, completions: 12, completionDays: 4 }],
    ["fewer than 10 completions", { tenureDays: 20, completions: 9, completionDays: 4 }],
    ["fewer than 3 completion days", { tenureDays: 20, completions: 12, completionDays: 2 }],
  ])("stays hidden with %s", (_label, engagement) => {
    expect(shouldShowFeedbackNudge({ engagement, ...quiet })).toBe(false);
  });

  it("stays hidden for 90 days after feedback was sent", () => {
    expect(
      shouldShowFeedbackNudge({ engagement: returning, ...quiet, lastSentAt: daysAgo(89) }),
    ).toBe(false);
    expect(
      shouldShowFeedbackNudge({ engagement: returning, ...quiet, lastSentAt: daysAgo(91) }),
    ).toBe(true);
  });

  it("stays hidden for 180 days after being dismissed", () => {
    expect(
      shouldShowFeedbackNudge({ engagement: returning, ...quiet, dismissedAt: daysAgo(179) }),
    ).toBe(false);
    expect(
      shouldShowFeedbackNudge({ engagement: returning, ...quiet, dismissedAt: daysAgo(181) }),
    ).toBe(true);
  });

  it("stays hidden while the user has an unsent draft", () => {
    expect(shouldShowFeedbackNudge({ engagement: returning, ...quiet, hasDraft: true })).toBe(
      false,
    );
  });

  it("treats an unparseable stored timestamp as never", () => {
    expect(
      shouldShowFeedbackNudge({ engagement: returning, ...quiet, lastSentAt: "not-a-date" }),
    ).toBe(true);
  });
});
