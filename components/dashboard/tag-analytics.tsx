"use client";

import { useMemo } from "react";
import type { TagStatistic } from "@/lib/analytics";

interface TagAnalyticsProps {
  tagStats: TagStatistic[];
  maxTags?: number;
}

const BAR_COLORS = [
  "bg-accent",
  "bg-olive",
  "bg-warning",
  "bg-rust",
  "bg-sky",
  "bg-accent-d",
  "bg-info",
  "bg-gray-500",
  "bg-olive",
  "bg-warning-dark",
];

/**
 * Horizontal bar visualization showing tag usage and completion rates.
 * Replaces the previous table layout with a more visual, dashboard-friendly design.
 */
export function TagAnalytics({ tagStats, maxTags = 10 }: TagAnalyticsProps) {
  const { displayTags, maxCount } = useMemo(() => {
    const nextDisplayTags = tagStats.slice(0, maxTags);
    let nextMaxCount = 1;
    for (const tag of nextDisplayTags) {
      if (tag.count > nextMaxCount) nextMaxCount = tag.count;
    }
    return { displayTags: nextDisplayTags, maxCount: nextMaxCount };
  }, [maxTags, tagStats]);

  if (displayTags.length === 0) {
    return (
      <div className="rounded-lg border-hair border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 rd-serif text-title text-foreground">Top Tags</h3>
        <p className="text-sm text-foreground-muted">
          No tags to display. Add tags to your tasks to see analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-hair border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 rd-serif text-title text-foreground">Top Tags</h3>
      <div className="space-y-3">
        {displayTags.map((stat, index) => {
          const barWidth = Math.max((stat.count / maxCount) * 100, 4);
          const barColor = BAR_COLORS[index % BAR_COLORS.length];

          return (
            <div key={stat.tag} className="group">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {stat.tag}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-foreground-muted">
                    {stat.completedCount}/{stat.count} done
                  </span>
                  <span className="min-w-[3ch] text-right text-xs font-semibold tabular-nums text-foreground">
                    {stat.completionRate}%
                  </span>
                </div>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-background-muted">
                {/* Total tasks bar (full width relative to max) */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full opacity-25 transition-all ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
                {/* Completed portion (filled) */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${barColor}`}
                  style={{
                    width: `${barWidth * (stat.completionRate / 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
