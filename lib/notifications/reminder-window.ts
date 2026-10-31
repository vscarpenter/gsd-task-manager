import { NOTIFICATION_TIMING } from "@/lib/constants";
import { timeOf } from "@/lib/due-time";

/** An all-day task is reminded at this local hour on its due day (owner decision 6). */
const ALL_DAY_REMINDER_HOUR = 8;

const GRACE_MS = -NOTIFICATION_TIMING.OVERDUE_NOTIFICATION_THRESHOLD * NOTIFICATION_TIMING.MS_PER_MINUTE;

export interface QuietHours {
  /** "HH:mm". Quiet hours are off unless both are set. */
  start?: string;
  end?: string;
}

export interface ReminderWindow {
  /** When the reminder becomes due. */
  fire: Date;
  /** After this the reminder is dropped, so a long-closed app doesn't replay it. */
  expires: Date;
}

/**
 * When a due date's reminder fires and stops being sent.
 *
 * A timed task fires at its due time minus the offset and expires an hour past
 * the due time. An all-day task (local midnight) fires at 08:00 local on its due
 * day, one day earlier per whole day of offset, and expires an hour after that,
 * since an hour past midnight would drop every 08:00 reminder.
 */
export function reminderWindow(
  dueIso: string,
  notifyBeforeMinutes: number,
  quiet: QuietHours = {},
): ReminderWindow {
  const due = new Date(dueIso);
  if (timeOf(dueIso)) {
    const fire = new Date(due.getTime() - notifyBeforeMinutes * NOTIFICATION_TIMING.MS_PER_MINUTE);
    return { fire: deferPastQuietHours(fire, quiet), expires: new Date(due.getTime() + GRACE_MS) };
  }
  const wholeDays = Math.floor(notifyBeforeMinutes / NOTIFICATION_TIMING.MINUTES_PER_DAY);
  const planned = new Date(due.getFullYear(), due.getMonth(), due.getDate() - wholeDays, ALL_DAY_REMINDER_HOUR);
  // The hour is measured from the deferred fire time, or quiet hours ending at
  // 09:00 would drop the 09:00 reminder.
  const fire = deferPastQuietHours(planned, quiet);
  return { fire, expires: new Date(fire.getTime() + GRACE_MS) };
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Quiet hours are a half-open window that may cross midnight. A fire inside one waits for its end. */
function deferPastQuietHours(fire: Date, quiet: QuietHours): Date {
  if (!quiet.start || !quiet.end) return fire;
  const start = minutesOfDay(quiet.start);
  const end = minutesOfDay(quiet.end);
  const at = fire.getHours() * 60 + fire.getMinutes();
  const inWindow = start > end ? at >= start || at < end : at >= start && at < end;
  if (!inWindow) return fire;
  const endToday = new Date(fire.getFullYear(), fire.getMonth(), fire.getDate(), Math.floor(end / 60), end % 60);
  return endToday > fire
    ? endToday
    : new Date(fire.getFullYear(), fire.getMonth(), fire.getDate() + 1, Math.floor(end / 60), end % 60);
}

/**
 * When a reminder will fire, or null when it won't: a future snooze is the fire
 * time, and a fire time that has passed fires nothing. Quiet hours defer either.
 * Mirrors Android `ReminderPlanner.fireTime` for the shared due-time corpus.
 */
export function reminderFireAt(args: {
  dueIso: string;
  notifyBefore: number;
  now: Date;
  snoozedUntil?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}): Date | null {
  const quiet = { start: args.quietHoursStart, end: args.quietHoursEnd };
  const snoozed = args.snoozedUntil ? new Date(args.snoozedUntil) : undefined;
  const base = snoozed && snoozed > args.now
    ? snoozed
    : reminderWindow(args.dueIso, args.notifyBefore).fire;
  if (base <= args.now) return null;
  return deferPastQuietHours(base, quiet);
}
