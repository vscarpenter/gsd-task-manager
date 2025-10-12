"use client";

import type { TagStatistic } from "@/lib/analytics";

interface TagAnalyticsProps {
  tagStats: TagStatistic[];
  maxTags?: number;
}

/**
 * Table showing tag usage and completion rates
 */
export function TagAnalytics({ tagStats, maxTags = 10 }: TagAnalyticsProps) {
  const displayTags = tagStats.slice(0, maxTags);

  if (displayTags.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Tag Analytics</h3>
        <p className="text-sm text-foreground-muted">No tags to display. Add tags to your tasks to see analytics here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Tag Analytics</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-background-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-foreground-muted">Tag</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-foreground-muted">Tasks</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-foreground-muted">Completed</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-foreground-muted">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayTags.map((stat) => (
              <tr key={stat.tag} className="hover:bg-background-muted/50 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                    {stat.tag}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-foreground">{stat.count}</td>
                <td className="px-4 py-3 text-right text-sm text-foreground">{stat.completedCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-background-muted">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${stat.completionRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground">{stat.completionRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
