"use client";

import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TrendDataPoint } from "@/lib/analytics";

interface CompletionChartProps {
  data: TrendDataPoint[];
  chartType?: "line" | "bar";
}

/**
 * Chart showing task completions over time
 */
export function CompletionChart({ data, chartType = "line" }: CompletionChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: formatDate(point.date),
      Completed: point.completed,
      Created: point.created
    }));
  }, [data]);

  const Chart = chartType === "line" ? LineChart : BarChart;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Completion Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <Chart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          <Legend />
          {chartType === "line" ? (
            <>
              <Line
                type="monotone"
                dataKey="Completed"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Created"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </>
          ) : (
            <>
              <Bar dataKey="Completed" fill="#2563eb" />
              <Bar dataKey="Created" fill="#10b981" />
            </>
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
