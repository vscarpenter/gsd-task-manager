"use client";

import { FlameIcon } from "lucide-react";
import type { StreakData } from "@/lib/analytics";

interface StreakIndicatorProps {
  streakData: StreakData;
}

/**
 * Visual indicator for current and longest completion streak
 */
export function StreakIndicator({ streakData }: StreakIndicatorProps) {
  const { current, longest } = streakData;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-orange-100 p-3">
          <FlameIcon className="h-8 w-8 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground-muted">Current Streak</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {current} {current === 1 ? 'day' : 'days'}
          </p>
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

      {current === 0 && (
        <p className="mt-4 text-sm text-foreground-muted">
          Complete a task today to start your streak! 🔥
        </p>
      )}
    </div>
  );
}
