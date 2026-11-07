"use client";

import { AlertTriangleIcon, ClockIcon } from "lucide-react";
import { cn, daysOverdue, formatRelative, isDueToday, isOverdue } from "@/lib/utils";
import { DATE_CONFIG, TIME_MS } from "@/lib/constants";
import type { TaskRecord } from "@/lib/types";

/** True when a future due date is within 24h. Used to color-shift the clock glyph. */
function isWithinDay(iso: string): boolean {
  const due = new Date(iso).getTime();
  const now = Date.now();
  const diff = due - now;
  return diff > 0 && diff < TIME_MS.DAY;
}

const SHORT_DATE = new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, { month: "short", day: "numeric" });
const DATE_WITH_YEAR = new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, { month: "short", day: "numeric", year: "numeric" });

/** Adds the year only when it differs, so a mistyped year shows on the card. */
function formatOverdueDate(iso: string): string {
  const date = new Date(iso);
  const formatter = date.getFullYear() === new Date().getFullYear() ? SHORT_DATE : DATE_WITH_YEAR;
  return formatter.format(date);
}

/**
 * "2d overdue · Aug 20". The date half is the point of moving this into the
 * footer: the old corner badge stated the age and hid the date it was measured
 * from, which is the one number a reader needs to reschedule.
 */
function overdueLabel(days: number, dueDate?: string): string {
  const age = `${days}d overdue`;
  return dueDate ? `${age} · ${formatOverdueDate(dueDate)}` : age;
}

export interface DueChipProps {
  task: TaskRecord;
  taskIsOverdue: boolean;
  taskIsDueToday: boolean;
  /** Whole days past due; only read when taskIsOverdue. */
  overdueDays: number;
}

/** The due state of an open task, worked out the way the card works it out. Rows outside the card use it too. */
export function dueChipProps(task: TaskRecord): Omit<DueChipProps, "task"> {
  const taskIsOverdue = !task.completed && isOverdue(task.dueDate);
  return {
    taskIsOverdue,
    taskIsDueToday: !task.completed && isDueToday(task.dueDate),
    overdueDays: taskIsOverdue ? daysOverdue(task.dueDate) : 0,
  };
}

/** The card's due chip: overdue, due today, or the relative date. Nothing when there is no due date. */
export function DueChip({ task, taskIsOverdue, taskIsDueToday, overdueDays }: DueChipProps) {
  return (
    <>
        {taskIsOverdue ? (
          // Same anatomy as the "Due today" chip below, one row down the
          // temperature scale, so the footer stays a single scan column
          // instead of asking the eye to also check the card's corner.
          <span
            data-testid="task-card-overdue-chip"
            className="flex items-center gap-1 rounded-full bg-status-overdue-muted px-[9px] py-0.5 font-semibold text-status-overdue-ink"
          >
            <AlertTriangleIcon className="h-3 w-3 shrink-0" aria-hidden />
            {overdueLabel(overdueDays, task.dueDate)}
          </span>
        ) : taskIsDueToday ? (
          // Due today reads as accent-semibold; the warning glyph is reserved
          // for the overdue state. Text is --accent-d, not --accent: the base
          // accent measures 4.53:1 on its own tint, too close to the floor.
          <span className="flex items-center gap-1 rounded-full bg-accent-tint px-[9px] py-0.5 text-accent-d font-semibold">
            <ClockIcon className="h-3 w-3" />
            Due today
          </span>
        ) : task.dueDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 truncate",
              isWithinDay(task.dueDate) && "text-status-overdue-ink"
            )}
          >
            <ClockIcon className="h-3 w-3 shrink-0" aria-hidden />
            {formatRelative(task.dueDate)}
          </span>
        ) : null}
    </>
  );
}
