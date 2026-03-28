"use client";

import { FlameIcon, TrophyIcon } from "lucide-react";
import type { StreakData } from "@/lib/analytics";

interface StreakIndicatorProps {
  streakData: StreakData;
}

const DAY_LABELS = ["6d", "5d", "4d", "3d", "2d", "1d", "Today"];

/**
 * Get encouraging message based on streak length
 */
function getStreakMessage(current: number): string {
  if (current === 0) return "Start fresh today!";
  if (current <= 3) return "Building momentum...";
  if (current < 7) return "Great consistency!";
  return "On fire! Keep going!";
}

/**
 * Get milestone info for the current streak
 */
function getMilestone(current: number): { label: string; reached: boolean } | null {
  if (current >= 100) return { label: "100 days", reached: true };
  if (current >= 30) return { label: "30 days", reached: true };
  if (current >= 7) return { label: "7 days", reached: true };
  return null;
}

/**
 * Visual indicator for current and longest completion streak
 */
export function StreakIndicator({ streakData }: StreakIndicatorProps) {
  const { current, longest, last7Days } = streakData;
  const milestone = getMilestone(current);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-orange-100 dark:bg-orange-900/40 p-3">
          <FlameIcon className="h-8 w-8 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground-muted">Current Streak</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-3xl font-bold text-foreground">
              {current} {current === 1 ? 'day' : 'days'}
            </p>
            {milestone && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <TrophyIcon className="h-3 w-3" />
                {milestone.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 7-day activity dots */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-foreground-muted">Last 7 days</p>
        <div className="flex items-center gap-1.5">
          {last7Days.map((active, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div
                className={`h-3.5 w-3.5 rounded-full transition-colors ${
                  active
                    ? "bg-orange-500 shadow-sm shadow-orange-500/30"
                    : "bg-background-muted"
                }`}
                title={`${DAY_LABELS[index]}: ${active ? "Completed" : "No completions"}`}
              />
              <span className="text-[10px] text-foreground-muted/60">{DAY_LABELS[index]}</span>
            </div>
          ))}
        </div>
      </div>

      {longest > 0 && (
        <div className="mt-4 rounded-lg bg-background-muted p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground-muted">Longest Streak</span>
            <span className="text-lg font-semibold text-foreground">
              {longest} {longest === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-foreground-muted">
        {getStreakMessage(current)}
      </p>
    </div>
  );
}
