import type { SweepReminder } from "@/lib/weekly-sweep";

/**
 * Per-device weekly sweep state (spec: tasks/spec-weekly-sweep.md section 6).
 * Both values stay outside sync and outside the backup envelope, like the
 * escalation window, and a reset must clear both.
 */

export const SWEEP_LAST_SWEPT_KEY = "gsd:weekly-sweep-last-swept";
export const SWEEP_REMINDER_KEY = "gsd:weekly-sweep-reminder";
/** The occurrence the checker last notified for, so one occurrence fires once. */
export const SWEEP_FIRED_KEY = "gsd:weekly-sweep-reminder-fired";

/** What turning the reminder on starts at: Sunday 09:00. */
export const DEFAULT_SWEEP_REMINDER: SweepReminder = { enabled: true, weekday: 7, time: "09:00" };

const OFF: SweepReminder = { ...DEFAULT_SWEEP_REMINDER, enabled: false };
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isReminder(value: unknown): value is SweepReminder {
  if (typeof value !== "object" || value === null) return false;
  const { enabled, weekday, time } = value as Record<string, unknown>;
  return (
    typeof enabled === "boolean" &&
    Number.isInteger(weekday) &&
    (weekday as number) >= 1 &&
    (weekday as number) <= 7 &&
    typeof time === "string" &&
    TIME_PATTERN.test(time)
  );
}

export function readLastSwept(): Date | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SWEEP_LAST_SWEPT_KEY);
  const parsed = stored ? new Date(stored) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

/** Reaching the end of a sweep, or tapping Done, stamps this device. */
export function stampLastSwept(at: Date): void {
  window.localStorage.setItem(SWEEP_LAST_SWEPT_KEY, at.toISOString());
}

/** An unknown or unreadable stored value reads as off. */
export function readSweepReminder(): SweepReminder {
  if (typeof window === "undefined") return OFF;
  const stored = window.localStorage.getItem(SWEEP_REMINDER_KEY);
  if (!stored) return OFF;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isReminder(parsed) ? parsed : OFF;
  } catch {
    return OFF;
  }
}

export function writeSweepReminder(reminder: SweepReminder): void {
  window.localStorage.setItem(SWEEP_REMINDER_KEY, JSON.stringify(reminder));
}

export function readSweepFired(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(SWEEP_FIRED_KEY);
}

export function markSweepFired(occurrence: Date): void {
  window.localStorage.setItem(SWEEP_FIRED_KEY, occurrence.toISOString());
}

export function resetWeeklySweepState(): void {
  window.localStorage.removeItem(SWEEP_LAST_SWEPT_KEY);
  window.localStorage.removeItem(SWEEP_REMINDER_KEY);
  window.localStorage.removeItem(SWEEP_FIRED_KEY);
}
