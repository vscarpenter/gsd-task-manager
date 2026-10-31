import { NOTIFICATION_TIMING } from "@/lib/constants";
import { timeOf } from "@/lib/due-time";

/** An all-day task is reminded at this local hour on its due day (owner decision 6). */
const ALL_DAY_REMINDER_HOUR = 8;

const GRACE_MS = -NOTIFICATION_TIMING.OVERDUE_NOTIFICATION_THRESHOLD * NOTIFICATION_TIMING.MS_PER_MINUTE;

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
export function reminderWindow(dueIso: string, notifyBeforeMinutes: number): ReminderWindow {
  const due = new Date(dueIso);
  if (timeOf(dueIso)) {
    return {
      fire: new Date(due.getTime() - notifyBeforeMinutes * NOTIFICATION_TIMING.MS_PER_MINUTE),
      expires: new Date(due.getTime() + GRACE_MS),
    };
  }
  const wholeDays = Math.floor(notifyBeforeMinutes / NOTIFICATION_TIMING.MINUTES_PER_DAY);
  const fire = new Date(due.getFullYear(), due.getMonth(), due.getDate() - wholeDays, ALL_DAY_REMINDER_HOUR);
  return { fire, expires: new Date(fire.getTime() + GRACE_MS) };
}
