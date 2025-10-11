"use client";

import { Button } from "@/components/ui/button";

interface MatrixEmptyStateProps {
  onCreateTask: () => void;
}

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
      <div className="rounded-3xl border border-card-border bg-gradient-to-br from-background-muted to-background p-8 text-center shadow-sm">
        <h2 className="text-2xl font-bold text-foreground">Welcome to GSD Task Manager</h2>
        <p className="mt-3 text-base text-foreground-muted">
          <span className="font-semibold">Get Stuff Done</span> using the Eisenhower Matrix — a proven productivity framework that helps you prioritize what truly matters.
        </p>
      </div>

      {/* Matrix explanation */}
      <div className="rounded-3xl border border-card-border bg-card p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">How the Eisenhower Matrix Works</h3>
        <p className="mt-2 text-sm text-foreground-muted">
          Tasks are organized into four quadrants based on urgency and importance:
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Q1 */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <h4 className="font-semibold text-blue-900">Do First</h4>
            </div>
            <p className="mt-2 text-xs text-blue-700">
              Urgent + Important<br />
              Crises and deadlines requiring immediate attention
            </p>
          </div>

          {/* Q2 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <h4 className="font-semibold text-amber-900">Schedule</h4>
            </div>
            <p className="mt-2 text-xs text-amber-700">
              Not Urgent + Important<br />
              Long-term goals and strategic planning
            </p>
          </div>

          {/* Q3 */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <h4 className="font-semibold text-emerald-900">Delegate</h4>
            </div>
            <p className="mt-2 text-xs text-emerald-700">
              Urgent + Not Important<br />
              Tasks that can be delegated to others
            </p>
          </div>

          {/* Q4 */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-purple-500" />
              <h4 className="font-semibold text-purple-900">Eliminate</h4>
            </div>
            <p className="mt-2 text-xs text-purple-700">
              Not Urgent + Not Important<br />
              Time-wasters to minimize or eliminate
            </p>
          </div>
        </div>
      </div>

      {/* Quick tips */}
      <div className="rounded-3xl border border-card-border bg-card p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Quick Tips</h3>
        <ul className="mt-4 space-y-2 text-sm text-foreground-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-foreground-muted">•</span>
            <span>Press <kbd className="rounded border border-border bg-background-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">n</kbd> to create a new task</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-foreground-muted">•</span>
            <span>All your data stays private in your browser — nothing is sent to any server</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-foreground-muted">•</span>
            <span>Export your tasks regularly to keep a backup</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-foreground-muted">•</span>
            <span>Press <kbd className="rounded border border-border bg-background-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">?</kbd> anytime to see all keyboard shortcuts</span>
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Button className="px-8 py-3 text-base" onClick={onCreateTask}>
          Create your first task
        </Button>
      </div>
    </div>
  );
}
