"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { QuadrantId } from "@/lib/types";
import { quadrants } from "@/lib/quadrants";

interface QuadrantDistributionProps {
  distribution: Record<QuadrantId, number>;
}

const COLORS: Record<QuadrantId, string> = {
  "urgent-important": "#ef4444",       // red-500 (Do First)
  "not-urgent-important": "#3b82f6",   // blue-500 (Schedule)
  "urgent-not-important": "#f59e0b",   // amber-500 (Delegate)
  "not-urgent-not-important": "#6b7280" // gray-500 (Eliminate)
};

/**
 * Pie chart showing task distribution across quadrants
 */
export function QuadrantDistribution({ distribution }: QuadrantDistributionProps) {
  const data = quadrants
    .map(quadrant => ({
      name: quadrant.title,
      value: distribution[quadrant.id],
      id: quadrant.id
    }))
    .filter(item => item.value > 0); // Only show non-empty quadrants

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Quadrant Distribution</h3>
        <div className="flex h-[300px] items-center justify-center">
          <p className="text-sm text-foreground-muted">No active tasks to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Quadrant Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={true}
            label
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.id}`} fill={COLORS[entry.id as QuadrantId]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(var(--card-background))',
              border: '1px solid rgb(var(--border))',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'rgb(var(--foreground))'
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
