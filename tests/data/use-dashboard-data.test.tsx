import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardData } from "@/app/(dashboard)/dashboard/use-dashboard-data";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";

const NOW = new Date("2026-06-28T12:00:00.000Z");

function dateDaysAgo(daysAgo: number): string {
  const date = new Date(NOW);
  date.setUTCDate(NOW.getUTCDate() - daysAgo);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

function dateDaysFromNow(daysFromNow: number): string {
  const date = new Date(NOW);
  date.setUTCDate(NOW.getUTCDate() + daysFromNow);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

function completedTask(id: string, daysAgo: number): TaskRecord {
  const timestamp = dateDaysAgo(daysAgo);
  return createMockTask({
    id,
    title: id,
    completed: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp,
  });
}

function activeTask(id: string, dueDate?: string): TaskRecord {
  return createMockTask({
    id,
    title: id,
    completed: false,
    createdAt: dateDaysAgo(0),
    updatedAt: dateDaysAgo(0),
    dueDate,
  });
}

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives above-pace trend insight and scheduling share from recent tasks", () => {
    const previousCompletions = [6, 5, 4, 3, 2, 1].map((daysAgo) =>
      completedTask(`completed-${daysAgo}`, daysAgo)
    );
    const todaysCompletions = [0, 1, 2].map((index) =>
      completedTask(`completed-today-${index}`, 0)
    );
    const activeTasks = [
      activeTask("scheduled-today", dateDaysFromNow(0)),
      activeTask("scheduled-tomorrow", dateDaysFromNow(1)),
      activeTask("unscheduled"),
    ];

    const { result } = renderHook(() =>
      useDashboardData([...previousCompletions, ...todaysCompletions, ...activeTasks], 7)
    );

    expect(result.current.completedSeries).toEqual([1, 1, 1, 1, 1, 1, 3]);
    expect(result.current.completedTrend).toBe(200);
    expect(result.current.previousSixAverage).toBe(1);
    expect(result.current.completedInsight).toBe("Above your recent pace");
    expect(result.current.plannedActiveShare).toBe(67);
    expect(result.current.activeInsight).toBe("1 unscheduled");
    expect(result.current.completionInsight).toBe("Healthy momentum");
  });

  it("prioritizes zero-today and overdue insights over trend and unscheduled copy", () => {
    const tasks = [
      completedTask("completed-yesterday", 1),
      activeTask("overdue", dateDaysAgo(2)),
      activeTask("unscheduled-a"),
      activeTask("unscheduled-b"),
    ];

    const { result } = renderHook(() => useDashboardData(tasks, 7));

    expect(result.current.metrics.completedToday).toBe(0);
    expect(result.current.completedInsight).toBe("Ready to start today");
    expect(result.current.activeInsight).toBe("1 overdue");
    expect(result.current.plannedActiveShare).toBe(33);
    expect(result.current.completionInsight).toBe("Room to tighten execution");
  });

  it("uses strong follow-through and well-scoped copy at healthy thresholds", () => {
    const completedTasks = Array.from({ length: 4 }, (_, index) =>
      completedTask(`completed-${index}`, index)
    );
    const tasks = [...completedTasks, activeTask("scheduled", dateDaysFromNow(2))];

    const { result } = renderHook(() => useDashboardData(tasks, 30));

    expect(result.current.metrics.completionRate).toBe(80);
    expect(result.current.completionInsight).toBe("Strong follow-through");
    expect(result.current.activeInsight).toBe("Well scoped");
    expect(result.current.plannedActiveShare).toBe(100);
  });
});
