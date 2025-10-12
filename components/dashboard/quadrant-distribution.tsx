"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { QuadrantId } from "@/lib/types";
import { quadrants } from "@/lib/quadrants";

interface QuadrantDistributionProps {
  distribution: Record<QuadrantId, number>;
}

const COLORS: Record<QuadrantId, string> = {
  "urgent-important": "#ef4444",
  "not-urgent-important": "#f59e0b",
  "urgent-not-important": "#10b981",
  "not-urgent-not-important": "#8b5cf6"
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
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
