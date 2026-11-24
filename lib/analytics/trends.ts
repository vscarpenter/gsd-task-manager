import type { TaskRecord, RecurrenceType } from "@/lib/types";
import { subDays } from "date-fns";
import { completionTime, localDayKey } from "./completion-day";
import type { TrendDataPoint } from "./metrics";

export function getCompletionTrend(tasks: TaskRecord[], days: number): TrendDataPoint[] {
  const now = new Date();
  const points = new Map<string, TrendDataPoint>();
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const date = localDayKey(subDays(now, daysAgo));
    points.set(date, { date, completed: 0, created: 0 });
  }

  if (points.size === 0) return [];
  for (const task of tasks) {
    const created = pointFor(new Date(task.createdAt), points);
    if (created) created.created++;
    if (task.completed) {
      const completed = pointFor(completionTime(task), points);
      if (completed) completed.completed++;
    }
  }

  return [...points.values()];
}

function pointFor(date: Date, points: Map<string, TrendDataPoint>): TrendDataPoint | undefined {
  return Number.isFinite(date.getTime()) ? points.get(localDayKey(date)) : undefined;
}

export function getRecurrenceBreakdown(tasks: TaskRecord[]): Record<RecurrenceType, number> {
  const breakdown: Record<RecurrenceType, number> = {
    none: 0,
    daily: 0,
    weekly: 0,
    monthly: 0
  };

  tasks.forEach(task => {
    if (!task.completed) {
      breakdown[task.recurrence]++;
    }
  });

  return breakdown;
}
