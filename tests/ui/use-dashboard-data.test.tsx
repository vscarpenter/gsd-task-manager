import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardData } from "@/app/(dashboard)/dashboard/use-dashboard-data";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";

function localIso(day: number, hour: number): string {
  return new Date(2026, 5, day, hour).toISOString();
}

function completedTask(id: string, day: number): TaskRecord {
  return createMockTask({
    id,
    title: `Completed ${id}`,
    completed: true,
    createdAt: localIso(day, 9),
    updatedAt: localIso(day, 15),
  });
}

function activeTask(id: string, dueDate?: string): TaskRecord {
  return createMockTask({
    id,
    title: `Active ${id}`,
    completed: false,
    dueDate,
    createdAt: localIso(20, 9),
    updatedAt: localIso(20, 9),
  });
}

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 27, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives dashboard card metrics from the last seven days while honoring the selected chart period", () => {
    const tasks = [
      ...[21, 22, 23, 24, 25, 26].map((day, index) => completedTask(`previous-${index}`, day)),
      completedTask("today-1", 27),
      completedTask("today-2", 27),
      completedTask("today-3", 27),
      activeTask("overdue", localIso(26, 0)),
      activeTask("scheduled", localIso(30, 0)),
      activeTask("unscheduled"),
    ];

    const { result } = renderHook(() => useDashboardData(tasks, 30));

    expect(result.current.trendData).toHaveLength(30);
    expect(result.current.completedSeries).toEqual([1, 1, 1, 1, 1, 1, 3]);
    expect(result.current.createdSeries).toEqual([1, 1, 1, 1, 1, 1, 3]);
    expect(result.current.completionRateSeries).toEqual([100, 100, 100, 100, 100, 100, 100]);
    expect(result.current.previousSixAverage).toBe(1);
    expect(result.current.completedTrend).toBe(200);
    expect(result.current.completedInsight).toBe("Above your recent pace");
    expect(result.current.activeInsight).toBe("1 overdue");
    expect(result.current.completionInsight).toBe("Healthy momentum");
    expect(result.current.plannedActiveShare).toBe(67);
  });

  it("keeps insight math finite for active tasks with no recent completions or due dates", () => {
    const tasks = [
      activeTask("one"),
      activeTask("two"),
    ];

    const { result } = renderHook(() => useDashboardData(tasks, 7));

    expect(result.current.completedSeries).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.current.completionRateSeries).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.current.previousSixAverage).toBe(0);
    expect(result.current.completedTrend).toBe(0);
    expect(result.current.completedInsight).toBe("Ready to start today");
    expect(result.current.activeInsight).toBe("2 unscheduled");
    expect(result.current.completionInsight).toBe("Room to tighten execution");
    expect(result.current.plannedActiveShare).toBe(0);
  });
});
