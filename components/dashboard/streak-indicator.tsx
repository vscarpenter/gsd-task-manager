"use client";

import { CalendarCheckIcon } from "lucide-react";
import type { StreakData } from "@/lib/analytics";

interface StreakIndicatorProps {
  streakData: StreakData;
}

const DAY_LABELS = ["6d", "5d", "4d", "3d", "2d", "1d", "Today"];

/**
 * Streak indicator for the dashboard top row. Shows the current streak, a
 * 7-day activity strip, and the personal best. Composed and factual to match
 * the calm dashboard voice — no flame, milestone badges, or cheerleading copy.
 */
export function StreakIndicator({ streakData }: StreakIndicatorProps) {
  const { current, longest, last7Days } = streakData;

  return (
    <div
      className="flex h-full flex-col justify-between rounded-lg border-hair border-border bg-card p-6"
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      {/* Top: eyebrow + count, with a calm icon matching the other stat cards */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-label font-semibold uppercase text-foreground-muted">
            Streak
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="rd-serif text-[48px] leading-none tabular-nums tracking-tight text-foreground">
              {current}
            </span>
            <span className="text-sm text-foreground-muted">
              {current === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-muted">
          <CalendarCheckIcon className="h-4 w-4 text-foreground-muted" aria-hidden />
        </div>
      </div>

      {/* Middle: 7-day activity strip — olive marks a completed day */}
      <div className="mt-4 flex items-center gap-1.5">
        {last7Days.map((active, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <div
              className={`h-3 w-3 rounded-full transition-colors ${
                active ? "bg-status-success" : "bg-background-muted"
              }`}
              title={`${DAY_LABELS[index]}: ${active ? "Completed" : "No completions"}`}
            />
            <span className="text-[10px] text-foreground-muted">
              {DAY_LABELS[index]}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom: factual personal best */}
      <p className="mt-4 text-xs text-foreground-muted">
        {longest > 0
          ? `Best ${longest} ${longest === 1 ? "day" : "days"}`
          : "No streak yet"}
      </p>
    </div>
  );
}
