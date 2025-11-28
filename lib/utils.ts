import { clsx } from "clsx";
import { TIME_MS } from "@/lib/constants";

export function cn(...classNames: Array<string | undefined | false | null>): string {
  return clsx(classNames);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function formatDueDate(value?: string): string {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  const dayOfWeek = date.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  return `${dayOfWeek} - ${dateStr}`;
}

export function formatRelative(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const dayDelta = Math.round(diff / TIME_MS.DAY);

  if (Math.abs(dayDelta) > 6) {
    return formatDueDate(value);
  }

  return formatter.format(dayDelta, "day");
}

/**
 * Check if a date is overdue (in the past)
 */
export function isOverdue(value?: string): boolean {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  const now = new Date();
  // Set both to start of day for fair comparison
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return date < now;
}

/**
 * Check if a date is due today
 */
export function isDueToday(value?: string): boolean {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

/**
 * Check if a date is due this week (includes overdue tasks)
 * Rationale: If something is overdue, it needs attention "this week"
 */
export function isDueThisWeek(value?: string): boolean {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + TIME_MS.WEEK);

  // Include overdue tasks - if it's overdue, you need to handle it this week
  // Also include tasks due within the next 7 days
  return date <= weekFromNow;
}
