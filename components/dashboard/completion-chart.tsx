"use client";

import dynamic from "next/dynamic";
import type { TrendDataPoint } from "@/lib/analytics";

// Load the recharts-backed graph on demand so recharts stays out of the
// initial bundle (client-only chart, no SSR).
const CompletionChartGraph = dynamic(() => import("./completion-chart-graph"), {
  ssr: false,
  loading: () => <div className="h-[280px]" aria-hidden />,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
});

interface CompletionChartProps {
  data: TrendDataPoint[];
}

/**
 * Trend chart showing task completion vs creation (editorial encoding):
 *   Completed → solid forest-green (status-success) line + ~8% area fill
 *   Created   → dotted graphite (ink-3), strokeWidth 1.6 — de-blued from the old accent
 * The single soft area anchors "completed" without crowding the comparison.
 */
export function CompletionChart({ data }: CompletionChartProps) {
  const chartData = data.map((point) => ({
    date: formatDate(point.date),
    Completed: point.completed,
    Created: point.created,
  }));

  return (
    <div className="rounded-lg border-hair border-border bg-card p-6" style={{ boxShadow: "var(--shadow-column)" }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="rd-serif text-title text-foreground">
            Completion Trend
          </h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Recent throughput across completed and newly created tasks.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background-muted/70 px-3 py-1.5">
          <span className="h-[2px] w-3 rounded-full bg-status-success" />
          <span className="text-xs font-medium text-foreground-muted">Completed</span>
          <span
            className="ml-2 h-[2px] w-3 rounded-full"
            style={{
              backgroundImage: "linear-gradient(to right, currentColor 50%, transparent 50%)",
              backgroundSize: "4px 2px",
              backgroundColor: "transparent",
              color: "var(--ink-3)",
            }}
          />
          <span className="text-xs font-medium text-foreground-muted">Created</span>
        </div>
      </div>
      <CompletionChartGraph chartData={chartData} />
    </div>
  );
}

function formatDate(isoDate: string): string {
  return DATE_FORMATTER.format(new Date(isoDate));
}
