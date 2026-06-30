"use client";

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

export interface CompletionChartDatum {
  date: string;
  Completed: number;
  Created: number;
}

/**
 * The recharts-backed graph for {@link CompletionChart}. Split into its own
 * module so it can be loaded on demand via `next/dynamic`, keeping recharts out
 * of the initial bundle.
 */
export default function CompletionChartGraph({ chartData }: { chartData: CompletionChartDatum[] }) {
  return (
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
          style={{ fontSize: "12px" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="currentColor"
          className="text-foreground-muted"
          style={{ fontSize: "12px" }}
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
  );
}
