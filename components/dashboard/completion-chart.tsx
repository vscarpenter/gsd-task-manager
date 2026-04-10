"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
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
 * Area chart showing task completion and creation trends.
 * Uses theme-aware colors via CSS variable-derived values.
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
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Completion Trend
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="gradientCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradientCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
              backgroundColor: "rgb(var(--card-background))",
              border: "1px solid rgb(var(--border))",
              borderRadius: "10px",
              fontSize: "13px",
              color: "rgb(var(--foreground))",
              boxShadow: "var(--shadow-card-hover)",
            }}
            cursor={{ stroke: "rgb(var(--foreground-muted))", strokeOpacity: 0.3 }}
          />
          <Area
            type="monotone"
            dataKey="Completed"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#gradientCompleted)"
            dot={false}
            activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="Created"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradientCreated)"
            dot={false}
            activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-xs text-foreground-muted">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-foreground-muted">Created</span>
        </div>
      </div>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
