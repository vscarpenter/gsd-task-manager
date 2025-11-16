/**
 * Date utility functions (no external dependencies)
 */

import type { DecryptedTask } from '../tools.js';

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
 * Check if task is due today
 */
export function isDueToday(task: DecryptedTask, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = startOfDay(new Date(task.dueDate));
  return dueDate.getTime() === today.getTime();
}

/**
 * Check if task is due this week
 */
export function isDueThisWeek(task: DecryptedTask, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = new Date(task.dueDate);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return isAfter(dueDate, today) && isBefore(dueDate, weekEnd);
}
