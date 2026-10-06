/**
 * Date utility functions (no external dependencies)
 */

import type { Task } from '../tools.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get start of day (00:00:00.000)
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get start of week (Sunday 00:00:00.000)
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get start of month (1st day 00:00:00.000)
 */
export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Check if date1 is after date2
 */
export function isAfter(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}

/**
 * Check if date1 is before date2
 */
export function isBefore(date1: Date, date2: Date): boolean {
  return date1.getTime() < date2.getTime();
}

/**
 * Subtract days from a date
 */
export function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * When a task was completed. Imports and pulls can carry a completed task with
 * no completedAt, so those fall back to updatedAt. Keep this rule in step with
 * the web copy in lib/analytics/completion-day.ts.
 */
export function completionTime(task: Pick<Task, 'completedAt' | 'updatedAt'>): Date {
  return new Date(task.completedAt || task.updatedAt);
}

/**
 * The local calendar day a moment falls on, as YYYY-MM-DD
 */
export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Calendar days from an earlier YYYY-MM-DD key to a later one. Both keys parse
 * as UTC midnight, so the difference is whole days whatever the local DST.
 */
export function daysBetweenKeys(laterKey: string, earlierKey: string): number {
  return Math.round((Date.parse(laterKey) - Date.parse(earlierKey)) / MS_PER_DAY);
}

/**
 * Check if task is due today
 */
export function isDueToday(task: Task, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = startOfDay(new Date(task.dueDate));
  return dueDate.getTime() === today.getTime();
}

/**
 * Check if task is due this week
 */
export function isDueThisWeek(task: Task, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = new Date(task.dueDate);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return isAfter(dueDate, today) && isBefore(dueDate, weekEnd);
}
