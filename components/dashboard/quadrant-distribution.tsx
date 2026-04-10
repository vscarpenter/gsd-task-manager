"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { QuadrantId } from "@/lib/types";
import { quadrants } from "@/lib/quadrants";

interface QuadrantDistributionProps {
  distribution: Record<QuadrantId, number>;
}

const COLORS: Record<QuadrantId, string> = {
  "urgent-important": "#ef4444",
  "not-urgent-important": "#3b82f6",
  "urgent-not-important": "#f59e0b",
  "not-urgent-not-important": "#6b7280",
};

const SHORT_LABELS: Record<QuadrantId, string> = {
  "urgent-important": "Do First",
  "not-urgent-important": "Schedule",
  "urgent-not-important": "Delegate",
  "not-urgent-not-important": "Eliminate",
};

/**
 * Donut chart showing task distribution across Eisenhower quadrants.
 * Displays the total task count in the center of the donut.
 */
export function QuadrantDistribution({ distribution }: QuadrantDistributionProps) {
  const data = quadrants
    .map((quadrant) => ({
      name: quadrant.title,
      shortName: SHORT_LABELS[quadrant.id],
      value: distribution[quadrant.id],
      id: quadrant.id,
    }))
    .filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Quadrant Distribution
        </h3>
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-sm text-foreground-muted">No active tasks to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Quadrant Distribution
      </h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.id}`}
                  fill={COLORS[entry.id as QuadrantId]}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "rgb(var(--card-background))",
                border: "1px solid rgb(var(--border))",
                borderRadius: "10px",
                fontSize: "13px",
                color: "rgb(var(--foreground))",
                boxShadow: "var(--shadow-card-hover)",
              }}
              formatter={(value, name) => [
                `${value} task${Number(value) !== 1 ? "s" : ""}`,
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label — total count */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums text-foreground">{total}</p>
            <p className="text-xs text-foreground-muted">active</p>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {data.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[entry.id as QuadrantId] }}
            />
            <span className="truncate text-xs text-foreground-muted">
              {entry.shortName}
            </span>
            <span className="ml-auto text-xs font-medium tabular-nums text-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
