import type { TaskRecord } from "@/lib/types";

export type DueBucket = "overdue" | "today" | "tomorrow" | "thisweek" | "nextweek" | "later" | "none";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dueBucket(iso: string | undefined, now: Date = new Date()): DueBucket {
  if (!iso) return "none";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "none";
  const today = startOfDay(now);
  const dueDay = startOfDay(due);
  const diff = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 6) return "thisweek";
  if (diff <= 13) return "nextweek";
  return "later";
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDueShort(iso: string | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const bucket = dueBucket(iso, now);
  if (bucket === "overdue") return "Overdue";
  if (bucket === "today") return "Today";
  if (bucket === "tomorrow") return "Tomorrow";
  if (bucket === "thisweek") return SHORT_WEEKDAYS[due.getDay()];
  if (bucket === "nextweek") return "Next week";
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isOverdue(task: Pick<TaskRecord, "dueDate" | "completed">, now: Date = new Date()): boolean {
  if (task.completed) return false;
  return dueBucket(task.dueDate, now) === "overdue";
}

/**
 * Quick-pick date presets used in the composer.
 * Returns ISO string for the corresponding day at local end of day, or undefined.
 */
export function presetDueDate(
  key: "none" | "today" | "tomorrow" | "thisfri" | "nextweek",
  now: Date = new Date()
): string | undefined {
  if (key === "none") return undefined;
  const base = startOfDay(now);
  let target: Date;
  if (key === "today") {
    target = base;
  } else if (key === "tomorrow") {
    target = addDays(base, 1);
  } else if (key === "thisfri") {
    const daysUntilFri = (5 - base.getDay() + 7) % 7 || 7;
    target = addDays(base, daysUntilFri);
  } else {
    target = addDays(base, 7);
  }
  target.setHours(17, 0, 0, 0);
  return target.toISOString();
}

export function presetLabel(key: "none" | "today" | "tomorrow" | "thisfri" | "nextweek"): string {
  if (key === "none") return "No date";
  if (key === "today") return "Today";
  if (key === "tomorrow") return "Tomorrow";
  if (key === "thisfri") return "Friday";
  return "Next week";
}

export function isSamePresetDue(iso: string | undefined, key: "none" | "today" | "tomorrow" | "thisfri" | "nextweek"): boolean {
  if (key === "none") return !iso;
  const preset = presetDueDate(key);
  if (!iso || !preset) return false;
  return startOfDay(new Date(iso)).getTime() === startOfDay(new Date(preset)).getTime();
}
