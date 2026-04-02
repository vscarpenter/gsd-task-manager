"use client";

import { useState } from "react";
import { FlameIcon, CalendarIcon, UsersIcon, TrashIcon, ChevronDownIcon, SparklesIcon } from "lucide-react";
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
 * Uses progressive disclosure: primary CTA up front,
 * educational content available on demand via collapsible section.
 */
export function MatrixEmptyState({ onCreateTask }: MatrixEmptyStateProps) {
  const [showLearnMore, setShowLearnMore] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero — headline + single CTA */}
      <div
        className="rounded-3xl border border-card-border/60 bg-gradient-to-br from-background-muted to-background p-10 text-center"
        style={{ boxShadow: 'var(--shadow-column)' }}
      >
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Get Stuff Done</h2>
        <p className="mx-auto mt-3 max-w-md text-base text-foreground-muted">
          Organize your tasks using the <span className="font-semibold text-accent">Eisenhower Matrix</span> — focus on what truly matters, eliminate what doesn&apos;t.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button className="px-8 py-3 text-base" onClick={onCreateTask}>
            <SparklesIcon className="mr-2 h-4 w-4" />
            Create your first task
          </Button>
          <p className="text-xs text-foreground-muted">
            Press <kbd className="rounded-md border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">n</kbd> anytime to create a task
          </p>
        </div>
      </div>

      {/* Collapsible learn section */}
      <div
        className="rounded-3xl border border-card-border/60 bg-card overflow-hidden"
        style={{ boxShadow: 'var(--shadow-column)' }}
      >
        <button
          type="button"
          onClick={() => setShowLearnMore(!showLearnMore)}
          className="flex w-full items-center justify-between px-8 py-5 text-left transition-colors hover:bg-background-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-expanded={showLearnMore}
        >
          <div>
            <h3 className="text-lg font-semibold text-foreground">How the Eisenhower Matrix works</h3>
            <p className="mt-0.5 text-sm text-foreground-muted">Learn how to prioritize tasks by urgency and importance</p>
          </div>
          <ChevronDownIcon className={`h-5 w-5 text-foreground-muted shrink-0 transition-transform duration-200 ${showLearnMore ? 'rotate-180' : ''}`} />
        </button>

        {showLearnMore && (
          <div className="border-t border-border/60 px-8 pb-8 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        )}
      </div>

      {/* Quick tips — condensed */}
      <div
        className="rounded-3xl border border-card-border/60 bg-card px-8 py-6"
        style={{ boxShadow: 'var(--shadow-column)' }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-foreground-muted">
          <span>
            <kbd className="rounded-md border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">?</kbd> Keyboard shortcuts
          </span>
          <span className="hidden sm:inline text-border">|</span>
          <span>
            <kbd className="rounded-md border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">&#8984;K</kbd> Command palette
          </span>
          <span className="hidden sm:inline text-border">|</span>
          <span>All data stays private in your browser</span>
        </div>
      </div>
    </div>
  );
}
