"use client";

import { useMemo } from "react";
import type { QuadrantId } from "@/lib/types";
import { quadrants, QUADRANT_ACCENT_BY_ID } from "@/lib/quadrants";

interface QuadrantDistributionProps {
  distribution: Record<QuadrantId, number>;
}

const SHORT_LABELS: Record<QuadrantId, string> = {
  "urgent-important": "Do First",
  "not-urgent-important": "Schedule",
  "urgent-not-important": "Delegate",
  "not-urgent-not-important": "Eliminate",
};

/**
 * Active task split across the matrix, rendered as a single horizontal
 * segmented bar. Saves vertical space and reinforces quadrant identity by
 * placing labels and colors on the same visual axis.
 */
export function QuadrantDistribution({ distribution }: QuadrantDistributionProps) {
  const { segments, total } = useMemo(() => {
    const items = quadrants
      .map((quadrant) => ({
        name: quadrant.title,
        shortName: SHORT_LABELS[quadrant.id],
        value: distribution[quadrant.id],
        id: quadrant.id,
        color: QUADRANT_ACCENT_BY_ID[quadrant.id],
      }))
      .filter((item) => item.value > 0);

    return {
      segments: items,
      total: items.reduce((sum, item) => sum + item.value, 0),
    };
  }, [distribution]);

  return (
    <div className="rounded-lg border-hair border-border bg-card p-6" style={{ boxShadow: "var(--shadow-column)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="rd-serif text-title text-foreground">
            Quadrant Distribution
          </h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Active work split across the matrix.
          </p>
        </div>
        <p className="text-sm tabular-nums text-foreground-muted">
          <span className="font-semibold text-foreground">{total}</span> active
        </p>
      </div>

      {segments.length === 0 ? (
        <div className="mt-6 flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-background-muted/30">
          <p className="text-sm text-foreground-muted">No active tasks to display</p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div
            className="flex h-3 overflow-hidden rounded-full"
            role="img"
            aria-label={`${total} active tasks across ${segments.length} quadrants`}
          >
            {segments.map((segment) => {
              const pct = (segment.value / total) * 100;
              return (
                <div
                  key={segment.id}
                  className="h-full"
                  style={{ width: `${pct}%`, backgroundColor: segment.color }}
                  title={`${segment.name}: ${segment.value} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
          <ul className="space-y-2.5">
            {segments.map((segment) => {
              const pct = Math.round((segment.value / total) * 100);
              return (
                <li key={segment.id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate font-medium text-foreground">
                    {segment.shortName}
                  </span>
                  <span className="tabular-nums text-foreground-muted">{segment.value}</span>
                  <span className="w-12 text-right tabular-nums text-foreground-muted">
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
