import type { TaskRecord, RecurrenceType } from "@/lib/types";
import { startOfDay, subDays, isAfter, isBefore } from "date-fns";
import type { TrendDataPoint } from "./metrics";

/**
 * Get completion trend data for the last N days
 */
export function getCompletionTrend(tasks: TaskRecord[], days: number): TrendDataPoint[] {
  const now = new Date();
  const dataPoints: TrendDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dataPoint = calculateDayDataPoint(tasks, now, i);
    dataPoints.push(dataPoint);
  }

  return dataPoints;
}

/**
 * Calculate trend data for a single day
 */
function calculateDayDataPoint(tasks: TaskRecord[], now: Date, daysAgo: number): TrendDataPoint {
  const date = startOfDay(subDays(now, daysAgo));
  const nextDate = startOfDay(subDays(now, daysAgo - 1));
  const dateStr = date.toISOString().split('T')[0];

  const completed = countCompletedInRange(tasks, date, nextDate);
  const created = countCreatedInRange(tasks, date, nextDate);

  return {
    date: dateStr,
    completed,
    created
  };
}

/**
 * Count tasks completed within date range
 */
function countCompletedInRange(tasks: TaskRecord[], startDate: Date, endDate: Date): number {
  return tasks.filter(t => {
    if (!t.completed) return false;
    const updatedAt = new Date(t.updatedAt);
    return isAfter(updatedAt, startDate) && isBefore(updatedAt, endDate);
  }).length;
}

/**
 * Count tasks created within date range
 */
function countCreatedInRange(tasks: TaskRecord[], startDate: Date, endDate: Date): number {
  return tasks.filter(t => {
    const createdAt = new Date(t.createdAt);
    return isAfter(createdAt, startDate) && isBefore(createdAt, endDate);
  }).length;
}

/**
 * Get task breakdown by recurrence type
 */
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
