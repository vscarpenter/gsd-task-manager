"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TrendDataPoint } from "@/lib/analytics";

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
  const chartData = useMemo(() => {
    return data.map((point) => ({
      date: formatDate(point.date),
      Completed: point.completed,
      Created: point.created,
    }));
  }, [data]);

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
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-border"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="date"
            stroke="currentColor"
            className="text-foreground-muted"
            style={{ fontSize: "11px" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="currentColor"
            className="text-foreground-muted"
            style={{ fontSize: "11px" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--paper)",
              border: "var(--border)",
              borderRadius: "10px",
              fontSize: "13px",
              color: "var(--slate)",
              boxShadow: "var(--shadow-card-hover)",
            }}
            cursor={{ stroke: "var(--gray-500)", strokeOpacity: 0.3 }}
          />
          <Area
            type="monotone"
            dataKey="Completed"
            stroke="var(--status-success)"
            strokeWidth={2}
            fill="var(--status-success)"
            fillOpacity={0.08}
            dot={false}
            activeDot={{ r: 5, fill: "var(--status-success)", stroke: "var(--paper)", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="Created"
            stroke="var(--ink-3)"
            strokeWidth={1.6}
            strokeDasharray="3 3"
            dot={false}
            activeDot={{ r: 5, fill: "var(--ink-3)", stroke: "var(--paper)", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}
