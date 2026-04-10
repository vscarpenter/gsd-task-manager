"use client";

import { FlameIcon, TrophyIcon } from "lucide-react";
import type { StreakData } from "@/lib/analytics";

interface StreakIndicatorProps {
  streakData: StreakData;
}

const DAY_LABELS = ["6d", "5d", "4d", "3d", "2d", "1d", "Today"];

function getStreakMessage(current: number): string {
  if (current === 0) return "Start fresh today!";
  if (current <= 3) return "Building momentum...";
  if (current < 7) return "Great consistency!";
  return "On fire! Keep going!";
}

function getMilestone(current: number): { label: string; reached: boolean } | null {
  if (current >= 100) return { label: "100 days", reached: true };
  if (current >= 30) return { label: "30 days", reached: true };
  if (current >= 7) return { label: "7 days", reached: true };
  return null;
}

/**
 * Compact streak indicator designed for the dashboard top row.
 * Shows current streak, 7-day activity dots, and milestone badges.
 */
export function StreakIndicator({ streakData }: StreakIndicatorProps) {
  const { current, longest, last7Days } = streakData;
  const milestone = getMilestone(current);

  return (
    <div
      className="flex h-full flex-col justify-between rounded-2xl border-2 border-border/80 bg-card p-6"
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      {/* Top: icon + streak count */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
          <FlameIcon className="h-6 w-6 text-orange-500" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Streak
          </p>
          <div className="flex items-center gap-2">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
              {current}
            </p>
            <span className="text-sm text-foreground-muted">
              {current === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
      </div>

      {/* Middle: 7-day activity dots */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5">
          {last7Days.map((active, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div
                className={`h-3 w-3 rounded-full transition-colors ${
                  active
                    ? "bg-orange-500 shadow-sm shadow-orange-500/30"
                    : "bg-background-muted"
                }`}
                title={`${DAY_LABELS[index]}: ${active ? "Completed" : "No completions"}`}
              />
              <span className="text-[9px] text-foreground-muted/60">
                {DAY_LABELS[index]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: milestone or longest streak or message */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-foreground-muted">{getStreakMessage(current)}</p>
        {milestone ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <TrophyIcon className="h-2.5 w-2.5" />
            {milestone.label}
          </span>
        ) : longest > 0 ? (
          <span className="text-[10px] text-foreground-muted">
            Best: {longest}d
          </span>
        ) : null}
      </div>
    </div>
  );
}
