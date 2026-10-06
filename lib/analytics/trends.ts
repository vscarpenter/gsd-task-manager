import type { TaskRecord, RecurrenceType } from "@/lib/types";
import { startOfDay, subDays, isBefore } from "date-fns";
import { completionTime, localDayKey } from "./completion-day";
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
  const dateStr = localDayKey(date);

  const completed = countCompletedInRange(tasks, date, nextDate);
  const created = countCreatedInRange(tasks, date, nextDate);

  return {
    date: dateStr,
    completed,
    created
  };
}

/**
 * Whether a moment falls in the half-open day [startDate, endDate), so a moment
 * at exactly local midnight belongs to the day that starts there
 */
function isInDay(moment: Date, startDate: Date, endDate: Date): boolean {
  return !isBefore(moment, startDate) && isBefore(moment, endDate);
}

/**
 * Count tasks completed within date range
 */
function countCompletedInRange(tasks: TaskRecord[], startDate: Date, endDate: Date): number {
  return tasks.filter(t => t.completed && isInDay(completionTime(t), startDate, endDate)).length;
}

/**
 * Count tasks created within date range
 */
function countCreatedInRange(tasks: TaskRecord[], startDate: Date, endDate: Date): number {
  return tasks.filter(t => isInDay(new Date(t.createdAt), startDate, endDate)).length;
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
