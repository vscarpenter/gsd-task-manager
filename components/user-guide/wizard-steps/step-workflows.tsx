"use client";

import { TrendingUpIcon, BarChart3Icon, CalendarIcon, SunIcon, CalendarDaysIcon } from "lucide-react";

/**
 * Step 5: Workflows & Analytics
 * Daily/weekly/monthly reviews and dashboard features
 */
export function StepWorkflows() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-1">
          <TrendingUpIcon className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Workflows & Analytics</h2>
        <p className="text-sm text-foreground-muted">Build habits and track your progress</p>
      </div>

      {/* Review Workflows */}
      <div className="space-y-3">
        <WorkflowCard
          icon={<SunIcon className="h-4 w-4" />}
          title="Daily Review"
          time="10 min"
          steps={[
            "Check 'Today's Focus' view",
            "Review Q1 — what's urgent?",
            "Pick 1-2 Q2 tasks to protect",
          ]}
        />

        <WorkflowCard
          icon={<CalendarIcon className="h-4 w-4" />}
          title="Weekly Planning"
          time="30 min"
          steps={[
            "Review completed — celebrate wins!",
            "Check 'Overdue Backlog'",
            "Plan next week's Q2 blocks",
          ]}
        />

        <WorkflowCard
          icon={<CalendarDaysIcon className="h-4 w-4" />}
          title="Monthly Review"
          time="1 hour"
          steps={[
            "Check Dashboard patterns",
            "Review quadrant distribution",
            "Set intention for next month",
          ]}
        />
      </div>

      {/* Dashboard */}
      <div className="rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3Icon className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Dashboard Analytics</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2 rounded bg-background-muted">
            <span className="text-accent">📊</span>
            <span className="text-foreground-muted">Completion trends</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-background-muted">
            <span className="text-accent">🔥</span>
            <span className="text-foreground-muted">Streak tracking</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-background-muted">
            <span className="text-accent">🏷️</span>
            <span className="text-foreground-muted">Tag analytics</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-background-muted">
            <span className="text-accent">📅</span>
            <span className="text-foreground-muted">Upcoming deadlines</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({
  icon,
  title,
  time,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
  steps: string[];
}) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-accent">{icon}</div>
          <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        </div>
        <span className="text-xs text-foreground-muted">{time}</span>
      </div>
      <ol className="text-xs text-foreground-muted space-y-0.5 list-decimal list-inside">
        {steps.map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
