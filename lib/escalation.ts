import type { QuadrantId, TaskRecord } from "@/lib/types";

/**
 * Escalation by due date (spec: tasks/spec-escalation.md, decisions D-11 and D-12).
 * A pure signal: it never changes a task. iOS and Android implement the same rule
 * against tests/fixtures/cross-platform/escalation-corpus.json.
 */

type EscalationTarget = Extract<QuadrantId, "urgent-important" | "urgent-not-important">;

export interface EscalationResult {
  escalating: boolean;
  daysUntilDue: number | null;
  reason: "overdue" | "due-soon" | null;
  target: EscalationTarget | null;
}

type EscalationTask = Pick<TaskRecord, "urgent" | "important" | "completed" | "savedAt" | "dueDate">;

const MS_PER_DAY = 86_400_000;

/** Local calendar date in `timeZone`, as a UTC midnight so day differences are exact across DST. */
function calendarDayNumber(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / MS_PER_DAY;
}

/** Local calendar days from `now` to `dueDate` in `timeZone`; negative once past, null with no due date. */
function daysUntilDue(dueDate: string | undefined, now: Date, timeZone: string): number | null {
  if (!dueDate) return null;
  return calendarDayNumber(new Date(dueDate), timeZone) - calendarDayNumber(now, timeZone);
}

/** `windowDays` is null when escalation is Off. */
export function evaluateEscalation(
  task: EscalationTask,
  now: Date,
  windowDays: number | null,
  timeZone: string
): EscalationResult {
  const days = daysUntilDue(task.dueDate, now, timeZone);
  const eligible =
    days !== null && windowDays !== null && !task.completed && !task.savedAt && !task.urgent;
  if (!eligible || days > windowDays) {
    return { escalating: false, daysUntilDue: days, reason: null, target: null };
  }
  return {
    escalating: true,
    daysUntilDue: days,
    reason: days < 0 ? "overdue" : "due-soon",
    target: task.important ? "urgent-important" : "urgent-not-important",
  };
}
