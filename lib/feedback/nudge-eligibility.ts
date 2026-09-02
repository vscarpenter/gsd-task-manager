import { TIME_MS } from "@/lib/constants";
import type { TaskRecord } from "@/lib/types";

/**
 * Decides when the Review page may invite feedback.
 *
 * Eligibility is derived from the user's own task data rather than an install
 * date: it works retroactively for people who were already here when this
 * shipped, adds no tracking key, and measures use rather than time since a
 * bookmark. Everything here is computed locally and nothing leaves the device.
 */

export const NUDGE_THRESHOLDS = {
  /** Days since the oldest task was created. */
  MIN_TENURE_DAYS: 14,
  MIN_COMPLETIONS: 10,
  /** Distinct calendar days with at least one completion. */
  MIN_COMPLETION_DAYS: 3,
  /** Quiet period after the user sent feedback. */
  SENT_COOLDOWN_DAYS: 90,
  /** Quiet period after the user pressed "Not now". */
  DISMISSED_COOLDOWN_DAYS: 180,
} as const;

export interface EngagementSummary {
  tenureDays: number;
  completions: number;
  completionDays: number;
}

export interface NudgeDecisionInput {
  engagement: EngagementSummary;
  lastSentAt: string | null;
  dismissedAt: string | null;
  hasDraft: boolean;
  now: Date;
}

function wholeDaysBetween(earlierMs: number, laterMs: number): number {
  return Math.floor((laterMs - earlierMs) / TIME_MS.DAY);
}

/** UTC calendar day, matching how `lib/analytics/streaks.ts` buckets completions. */
function utcDay(iso: string): string | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

export function summarizeEngagement(tasks: TaskRecord[], now: Date): EngagementSummary {
  let oldestCreatedMs = Number.POSITIVE_INFINITY;
  let completions = 0;
  const completionDays = new Set<string>();

  for (const task of tasks) {
    const createdMs = Date.parse(task.createdAt);
    if (!Number.isNaN(createdMs)) oldestCreatedMs = Math.min(oldestCreatedMs, createdMs);

    if (!task.completed) continue;
    completions += 1;
    const day = utcDay(task.completedAt ?? task.updatedAt);
    if (day) completionDays.add(day);
  }

  return {
    tenureDays: Number.isFinite(oldestCreatedMs)
      ? wholeDaysBetween(oldestCreatedMs, now.getTime())
      : 0,
    completions,
    completionDays: completionDays.size,
  };
}

/**
 * True while a cooldown started at `iso` is still running. A missing or
 * unparseable timestamp means the event never happened, so no cooldown applies.
 */
function withinCooldown(iso: string | null, cooldownDays: number, now: Date): boolean {
  if (iso === null) return false;
  const startedMs = Date.parse(iso);
  if (Number.isNaN(startedMs)) return false;
  return wholeDaysBetween(startedMs, now.getTime()) < cooldownDays;
}

export function shouldShowFeedbackNudge(input: NudgeDecisionInput): boolean {
  const { engagement, lastSentAt, dismissedAt, hasDraft, now } = input;

  if (hasDraft) return false;
  if (withinCooldown(lastSentAt, NUDGE_THRESHOLDS.SENT_COOLDOWN_DAYS, now)) return false;
  if (withinCooldown(dismissedAt, NUDGE_THRESHOLDS.DISMISSED_COOLDOWN_DAYS, now)) return false;

  return (
    engagement.tenureDays >= NUDGE_THRESHOLDS.MIN_TENURE_DAYS &&
    engagement.completions >= NUDGE_THRESHOLDS.MIN_COMPLETIONS &&
    engagement.completionDays >= NUDGE_THRESHOLDS.MIN_COMPLETION_DAYS
  );
}
