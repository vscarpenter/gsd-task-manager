/**
 * A due date's optional time of day (decision D-1, mirrors Android `DueTime.kt`).
 * A due date at local midnight is "all day"; any other time is a time of day.
 * Nothing extra is stored: the ISO instant carries both.
 */

const ALL_DAY_TIME = "00:00";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The ISO instant for a local "YYYY-MM-DD" and "HH:mm" (all day when `time` is undefined). */
export function combine(day: string, time: string | undefined): string {
  return fromLocal(day, time ?? ALL_DAY_TIME);
}

function fromLocal(day: string, time: string): string {
  return new Date(`${day}T${time}:00`).toISOString();
}

/** The local "HH:mm" of a due date, or undefined when it is all day. */
export function timeOf(iso: string): string | undefined {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return time === ALL_DAY_TIME ? undefined : time;
}

/** Moves the due date to `day`, keeping the time already set. No due date means all day. */
export function onDate(iso: string | undefined, day: string): string {
  return fromLocal(day, (iso && timeOf(iso)) || ALL_DAY_TIME);
}

/** Sets the time on the same local day. Undefined makes it all day again. */
export function atTime(iso: string, time: string | undefined): string {
  return fromLocal(localDay(new Date(iso)), time ?? ALL_DAY_TIME);
}

/** A short, locale-formatted time such as "3:30 PM", or undefined for an all-day due date. */
export function formatTimeOf(iso: string, locale?: string): string | undefined {
  if (!timeOf(iso)) return undefined;
  return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
