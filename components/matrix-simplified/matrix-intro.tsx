"use client";

import { ArrowDownRightIcon, CalendarRangeIcon } from "lucide-react";

interface MatrixIntroProps {
  /** Formatted local date for the h1; null until hydrated so the static export stays date-free. */
  dateLabel: string | null;
  /** One-sentence state reading from introMessage(); null while tasks load. */
  message: string | null;
  scheduleCount: number | null;
  onFocusSchedule: () => void;
}

function scheduleMessage(count: number): string {
  if (count === 0) return "Q2 is clear. Reserve the next strategic block here.";
  if (count === 1) return "1 strategic commitment needs protected time.";
  return `${count} strategic commitments need protected time.`;
}

// Firefox can restore a button's dynamic disabled state across reloads. React's
// button typings omit Firefox's supported autocomplete escape hatch, so spread
// the lowercase DOM attribute without weakening the component's prop types.
const preventPersistedDisabledState = { autoComplete: "off" } as const;

export function MatrixIntro({ dateLabel, message, scheduleCount, onFocusSchedule }: MatrixIntroProps) {
  return (
    <section className="mb-6 grid items-end gap-5 border-b border-border/70 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.58fr)] lg:gap-10">
      <div>
        <p className="text-eyebrow uppercase text-foreground-muted">Today&rsquo;s matrix</p>
        <h1 className="mt-3 text-display font-semibold text-foreground">
          <span className="sr-only">Today&rsquo;s matrix — </span>
          {dateLabel ?? " "}
        </h1>
        <p className="mt-3 max-w-[58ch] text-body text-foreground-muted">
          {message ?? " "}
        </p>
      </div>

      <aside className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-muted text-q2-ink"
        >
          <CalendarRangeIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-small font-semibold text-foreground">Protect Q2</p>
          <p className="mt-0.5 text-caption text-foreground-muted" aria-live="polite">
            {scheduleCount === null
              ? "Reserve one strategic block before reacting."
              : scheduleMessage(scheduleCount)}
          </p>
        </div>
        <button type="button"
          {...preventPersistedDisabledState}
          onClick={onFocusSchedule}
          disabled={scheduleCount === null}
          className="touch-target col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-small font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 sm:col-span-1"
        >
          Show Schedule
          <kbd className="rounded border border-on-accent/40 px-1.5 py-0.5 font-mono text-caption" aria-label="Option 2">
            ⌥2
          </kbd>
          <ArrowDownRightIcon className="h-4 w-4" aria-hidden />
        </button>
      </aside>
    </section>
  );
}
