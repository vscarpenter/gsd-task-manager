import { daysUntilDue, evaluateEscalation } from "@/lib/escalation";
import type { TaskRecord } from "@/lib/types";

/**
 * The weekly sweep rule (spec: tasks/spec-weekly-sweep.md, decision D-14). Pure:
 * it never changes a task. iOS and Android implement the same rule against
 * tests/fixtures/cross-platform/sweep-corpus.json. Every age is a count of local
 * calendar days in `zone`, never elapsed time.
 */

type SweepReason = "overdue" | "escalating" | "stale" | "saved" | "undated-schedule";

export interface SweepCard {
  id: string;
  reason: SweepReason;
}

/** `weekday` is ISO: 1 is Monday, 7 is Sunday. `time` is local `HH:mm`. */
export interface SweepReminder {
  enabled: boolean;
  weekday: number;
  time: string;
}

const STALE_DAYS = 14;
const SAVED_DAYS = 30;
const ENTRY_DAYS = 7;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

type SweepTask = Pick<
  TaskRecord,
  "id" | "urgent" | "important" | "completed" | "savedAt" | "dueDate" | "createdAt" | "updatedAt"
>;

/** Local calendar days since `iso`; negative when it is in the future. */
function ageInDays(iso: string, now: Date, zone: string): number {
  return -(daysUntilDue(iso, now, zone) ?? 0);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareInstant(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

function byDueThenImportant(a: SweepTask, b: SweepTask): number {
  return (
    compareInstant(a.dueDate!, b.dueDate!) ||
    Number(b.important) - Number(a.important) ||
    compareText(a.id, b.id)
  );
}

function byStaleOrder(a: SweepTask, b: SweepTask): number {
  const q4 = (t: SweepTask) => (!t.urgent && !t.important ? 0 : 1);
  return q4(a) - q4(b) || compareInstant(a.updatedAt, b.updatedAt) || compareText(a.id, b.id);
}

function bySavedOrder(a: SweepTask, b: SweepTask): number {
  return compareInstant(a.savedAt!, b.savedAt!) || compareText(a.id, b.id);
}

function byCreatedOrder(a: SweepTask, b: SweepTask): number {
  return compareInstant(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}

function unsavedReason(
  task: SweepTask,
  now: Date,
  windowDays: number | null,
  zone: string
): SweepReason | null {
  if (task.dueDate && (daysUntilDue(task.dueDate, now, zone) ?? 0) < 0) return "overdue";
  if (evaluateEscalation(task, now, windowDays, zone).reason === "due-soon") return "escalating";
  if (ageInDays(task.updatedAt, now, zone) >= STALE_DAYS) return "stale";
  if (task.important && !task.urgent && !task.dueDate) return "undated-schedule";
  return null;
}

/** Each task gets one card, from the first group it qualifies for. */
function reasonFor(
  task: SweepTask,
  now: Date,
  windowDays: number | null,
  zone: string
): SweepReason | null {
  if (task.savedAt) {
    return ageInDays(task.savedAt, now, zone) >= SAVED_DAYS ? "saved" : null;
  }
  return unsavedReason(task, now, windowDays, zone);
}

const GROUPS: { reason: SweepReason; order: (a: SweepTask, b: SweepTask) => number }[] = [
  { reason: "overdue", order: byDueThenImportant },
  { reason: "escalating", order: byDueThenImportant },
  { reason: "stale", order: byStaleOrder },
  { reason: "saved", order: bySavedOrder },
  { reason: "undated-schedule", order: byCreatedOrder },
];

/** `windowDays` is null when escalation is Off. Input is active-store rows. */
export function sweepCards(
  tasks: readonly SweepTask[],
  now: Date,
  windowDays: number | null,
  zone: string
): SweepCard[] {
  const grouped = new Map<SweepReason, SweepTask[]>();
  for (const task of tasks) {
    if (task.completed) continue;
    const reason = reasonFor(task, now, windowDays, zone);
    if (reason) grouped.set(reason, [...(grouped.get(reason) ?? []), task]);
  }
  return GROUPS.flatMap(({ reason, order }) =>
    (grouped.get(reason) ?? []).sort(order).map((task) => ({ id: task.id, reason }))
  );
}

/** True with at least one card and no sweep in the last seven local days. */
export function entryShown(
  lastSweptAt: Date | null,
  cardCount: number,
  now: Date,
  zone: string
): boolean {
  if (cardCount < 1) return false;
  if (!lastSweptAt) return true;
  return ageInDays(lastSweptAt.toISOString(), now, zone) >= ENTRY_DAYS;
}

/** The zone's offset from UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: number, zone: string): number {
  const whole = Math.floor(instant / 1000) * 1000;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(whole));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wall - whole;
}

/**
 * The instant a local wall time happens. A time inside a daylight-saving gap
 * shifts forward by the gap; one inside an overlap takes the first occurrence.
 */
function wallTimeToInstant(wallAsUtc: number, zone: string): number {
  const before = zoneOffsetMs(wallAsUtc - MS_PER_DAY, zone);
  const after = zoneOffsetMs(wallAsUtc + MS_PER_DAY, zone);
  const valid = [before, after]
    .map((offset) => wallAsUtc - offset)
    .filter((instant) => zoneOffsetMs(instant, zone) === wallAsUtc - instant);
  // In a gap neither guess round-trips, and the pre-transition offset lands after the gap.
  return valid.length > 0 ? Math.min(...valid) : wallAsUtc - before;
}

/** Local calendar date of `instant` in `zone`, as the UTC midnight of that date. */
function localDateAsUtc(instant: number, zone: string): number {
  return Math.floor((instant + zoneOffsetMs(instant, zone)) / MS_PER_DAY) * MS_PER_DAY;
}

/** ISO weekday of a UTC-midnight date: 1 is Monday, 7 is Sunday. */
function isoWeekday(dateAsUtc: number): number {
  return new Date(dateAsUtc).getUTCDay() || 7;
}

/** The next occurrence strictly after `now`, or null when the reminder is off. */
export function nextReminder(reminder: SweepReminder, now: Date, zone: string): Date | null {
  if (!reminder.enabled) return null;
  const [hours, minutes] = reminder.time.split(":").map(Number);
  const today = localDateAsUtc(now.getTime(), zone);
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = today + offset * MS_PER_DAY;
    if (isoWeekday(day) !== reminder.weekday) continue;
    const fire = wallTimeToInstant(day + hours * 60 * MS_PER_MINUTE + minutes * MS_PER_MINUTE, zone);
    if (fire > now.getTime()) return new Date(fire);
  }
  return null;
}
