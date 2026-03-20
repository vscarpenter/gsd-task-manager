"use client";

import { FlameIcon, CalendarIcon, UsersIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatrixEmptyStateProps {
  onCreateTask: () => void;
}

const quadrantInfo = [
  {
    icon: FlameIcon,
    title: "Do First",
    desc: "Urgent + Important",
    detail: "Crises and deadlines requiring immediate attention",
    borderClass: "border-blue-200 dark:border-blue-800",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    iconClass: "text-blue-500 dark:text-blue-400",
    titleClass: "text-blue-900 dark:text-blue-200",
    textClass: "text-blue-700 dark:text-blue-300"
  },
  {
    icon: CalendarIcon,
    title: "Schedule",
    desc: "Not Urgent + Important",
    detail: "Long-term goals and strategic planning",
    borderClass: "border-amber-200 dark:border-amber-800",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    iconClass: "text-amber-500 dark:text-amber-400",
    titleClass: "text-amber-900 dark:text-amber-200",
    textClass: "text-amber-700 dark:text-amber-300"
  },
  {
    icon: UsersIcon,
    title: "Delegate",
    desc: "Urgent + Not Important",
    detail: "Tasks that can be delegated to others",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    iconClass: "text-emerald-500 dark:text-emerald-400",
    titleClass: "text-emerald-900 dark:text-emerald-200",
    textClass: "text-emerald-700 dark:text-emerald-300"
  },
  {
    icon: TrashIcon,
    title: "Eliminate",
    desc: "Not Urgent + Not Important",
    detail: "Time-wasters to minimize or eliminate",
    borderClass: "border-purple-200 dark:border-purple-800",
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
    iconClass: "text-purple-500 dark:text-purple-400",
    titleClass: "text-purple-900 dark:text-purple-200",
    textClass: "text-purple-700 dark:text-purple-300"
  }
];

/**
 * Empty state shown when user has no tasks
 *
 * Provides onboarding information about the Eisenhower Matrix
 * and guides the user to create their first task.
 */
export function MatrixEmptyState({ onCreateTask }: MatrixEmptyStateProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Welcome header */}
      <div
        className="rounded-3xl border border-card-border/60 bg-gradient-to-br from-background-muted to-background p-10 text-center"
        style={{ boxShadow: 'var(--shadow-column)' }}
      >
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome to GSD Task Manager</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-foreground-muted">
          <span className="font-semibold text-accent">Get Stuff Done</span> using the Eisenhower Matrix — a proven productivity framework that helps you prioritize what truly matters.
        </p>
      </div>

      {/* Matrix explanation */}
      <div
        className="rounded-3xl border border-card-border/60 bg-card p-8"
        style={{ boxShadow: 'var(--shadow-column)' }}
      >
        <h3 className="text-lg font-semibold text-foreground">How the Eisenhower Matrix Works</h3>
        <p className="mt-2 text-sm text-foreground-muted">
          Tasks are organized into four quadrants based on urgency and importance:
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quadrantInfo.map((q) => (
            <div key={q.title} className={`rounded-xl border ${q.borderClass} ${q.bgClass} p-4 transition-all hover:-translate-y-0.5`} style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2">
                <q.icon className={`h-4 w-4 ${q.iconClass}`} />
                <h4 className={`font-semibold ${q.titleClass}`}>{q.title}</h4>
              </div>
              <p className={`mt-2 text-xs ${q.textClass}`}>
                {q.desc}<br />
                {q.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick tips */}
      <div
        className="rounded-3xl border border-card-border/60 bg-card p-8"
        style={{ boxShadow: 'var(--shadow-column)' }}
      >
        <h3 className="text-lg font-semibold text-foreground">Quick Tips</h3>
        <ul className="mt-4 space-y-3 text-sm text-foreground-muted">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-accent">•</span>
            <span>Press <kbd className="rounded-md border border-border bg-background-muted px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">n</kbd> to create a new task</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-accent">•</span>
            <span>All your data stays private in your browser — nothing is sent to any server</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-accent">•</span>
            <span>Export your tasks regularly to keep a backup</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-accent">•</span>
            <span>Press <kbd className="rounded-md border border-border bg-background-muted px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">?</kbd> anytime to see all keyboard shortcuts</span>
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center pb-4">
        <Button className="px-8 py-3 text-base" onClick={onCreateTask}>
          Create your first task
        </Button>
      </div>
    </div>
  );
}
