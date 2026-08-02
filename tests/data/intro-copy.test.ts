import { describe, it, expect } from "vitest";
import {
  deriveIntroStats,
  introDateLabel,
  introMessage,
  type IntroStats,
} from "@/components/matrix-simplified/intro-copy";
import type { TaskRecord } from "@/lib/types";

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: overrides.id ?? `task-${Math.random().toString(36).slice(2)}`,
    title: "Task",
    description: "",
    urgent: false,
    important: false,
    quadrant: "not-urgent-not-important",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
    ...overrides,
  };
}

function makeStats(overrides: Partial<IntroStats> = {}): IntroStats {
  return {
    activeTotal: 0,
    doFirstCount: 0,
    overdueTotal: 0,
    overdueQuadrants: [],
    ...overrides,
  };
}

const TODAY = "2026-08-01";

describe("introDateLabel", () => {
  it("formats a weekday, month, and day without the year", () => {
    expect(introDateLabel(new Date(2026, 7, 1))).toBe("Saturday, August 1");
  });

  it("formats single-digit days without padding", () => {
    expect(introDateLabel(new Date(2026, 0, 1))).toBe("Thursday, January 1");
  });
});

describe("deriveIntroStats", () => {
  it("counts only incomplete tasks as active", () => {
    const stats = deriveIntroStats(
      [makeTask(), makeTask(), makeTask({ completed: true })],
      TODAY
    );
    expect(stats.activeTotal).toBe(2);
  });

  it("counts Do First membership from the urgent/important flags", () => {
    const stats = deriveIntroStats(
      [
        makeTask({ urgent: true, important: true }),
        makeTask({ urgent: true, important: false }),
        makeTask({ urgent: true, important: true, completed: true }),
      ],
      TODAY
    );
    expect(stats.doFirstCount).toBe(1);
  });

  it("counts overdue as incomplete tasks due strictly before today", () => {
    const stats = deriveIntroStats(
      [
        makeTask({ dueDate: "2026-07-30" }),
        makeTask({ dueDate: TODAY }),
        makeTask({ dueDate: "2026-07-01", completed: true }),
        makeTask(),
      ],
      TODAY
    );
    expect(stats.overdueTotal).toBe(1);
  });

  it("collects deduped quadrant titles that hold overdue tasks", () => {
    const stats = deriveIntroStats(
      [
        makeTask({ urgent: true, important: true, dueDate: "2026-07-30" }),
        makeTask({ urgent: true, important: true, dueDate: "2026-07-29" }),
        makeTask({ urgent: false, important: true, dueDate: "2026-07-28" }),
      ],
      TODAY
    );
    expect(stats.overdueQuadrants).toEqual(["Do First", "Schedule"]);
  });
});

describe("introMessage", () => {
  it("invites capture when the board has no active tasks", () => {
    expect(introMessage(makeStats())).toBe(
      "The board is clear. Capture the first thing on your mind below."
    );
  });

  it("locates a single overdue task in its quadrant", () => {
    const stats = makeStats({
      activeTotal: 4,
      overdueTotal: 1,
      overdueQuadrants: ["Do First"],
    });
    expect(introMessage(stats)).toBe("The overdue task sits in Do First.");
  });

  it("uses 'Both' for two overdue tasks sharing a quadrant", () => {
    const stats = makeStats({
      activeTotal: 5,
      overdueTotal: 2,
      overdueQuadrants: ["Schedule"],
    });
    expect(introMessage(stats)).toBe("Both overdue tasks sit in Schedule.");
  });

  it("counts three or more overdue tasks sharing a quadrant", () => {
    const stats = makeStats({
      activeTotal: 6,
      overdueTotal: 3,
      overdueQuadrants: ["Do First"],
    });
    expect(introMessage(stats)).toBe("All 3 overdue tasks sit in Do First.");
  });

  it("asks for a fresh decision when overdue tasks are scattered", () => {
    const stats = makeStats({
      activeTotal: 6,
      overdueTotal: 2,
      overdueQuadrants: ["Do First", "Eliminate"],
    });
    expect(introMessage(stats)).toBe(
      "2 tasks are past their dates — give them a fresh decision."
    );
  });

  it("prefers the overdue message over the urgency-lean message", () => {
    const stats = makeStats({
      activeTotal: 5,
      doFirstCount: 4,
      overdueTotal: 1,
      overdueQuadrants: ["Do First"],
    });
    expect(introMessage(stats)).toBe("The overdue task sits in Do First.");
  });

  it("names the urgency lean when Do First holds the majority", () => {
    const stats = makeStats({ activeTotal: 5, doFirstCount: 3 });
    expect(introMessage(stats)).toBe(
      "Today leans urgent: most of the list sits in Do First."
    );
  });

  it("does not call an exact half a majority", () => {
    const stats = makeStats({ activeTotal: 4, doFirstCount: 2 });
    expect(introMessage(stats)).toBe(
      "Nothing overdue. Everything on the board is there by choice."
    );
  });

  it("skips the urgency lean on boards smaller than three tasks", () => {
    const stats = makeStats({ activeTotal: 2, doFirstCount: 2 });
    expect(introMessage(stats)).toBe(
      "Nothing overdue. Everything on the board is there by choice."
    );
  });

  it("falls back to the calm all-clear reading", () => {
    const stats = makeStats({ activeTotal: 3, doFirstCount: 1 });
    expect(introMessage(stats)).toBe(
      "Nothing overdue. Everything on the board is there by choice."
    );
  });
});
