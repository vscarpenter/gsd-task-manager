"use client";

import { CalendarRangeIcon } from "lucide-react";

interface MatrixIntroProps {
  /** Formatted local date for the h1; null until hydrated so the static export stays date-free. */
  dateLabel: string | null;
  /** One-sentence state reading from introMessage(); null while tasks load. */
  message: string | null;
  scheduleCount: number | null;
  onFocusSchedule: () => void;
}

/** The button's own label carries the count, so it has to fit on one line. */
function scheduleLabel(count: number | null): string {
  if (count === null) return "Protect Q2";
  if (count === 0) return "Protect Q2 · clear";
  return `Protect Q2 · ${count} to schedule`;
}

// Firefox can restore a button's dynamic disabled state across reloads. React's
// button typings omit Firefox's supported autocomplete escape hatch, so spread
// the lowercase DOM attribute without weakening the component's prop types.
const preventPersistedDisabledState = { autoComplete: "off" } as const;

export function MatrixIntro({ dateLabel, message, scheduleCount, onFocusSchedule }: MatrixIntroProps) {
  return (
    // One row, not two columns. The display-size date and the three-line
    // Protect Q2 card together cost ~190px before the first task, which on a
    // 13" laptop pushed the bottom two quadrant headers below the fold — the
    // matrix cannot make its argument if half of it is a scroll away.
    //
    // The row starts at sm. A phone cannot fit a 205px date, a sentence, and a
    // 193px button on one line: unconditional, the row overflowed 390px by
    // 64px and scrolled the page sideways.
    <section className="mb-5 flex flex-col items-start gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="shrink-0">
        <p className="text-eyebrow uppercase text-foreground-muted">Today&rsquo;s matrix</p>
        {/* h2 rather than display: at 24px the date still reads as the page's
            subject in the serif voice without spending a fifth of the fold. */}
        <h1 className="mt-1 text-h2 text-foreground">
          <span className="sr-only">Today&rsquo;s matrix — </span>
          {dateLabel ?? " "}
        </h1>
      </div>

      <p className="min-w-0 flex-1 text-small text-foreground-muted">
        {message ?? " "}
      </p>

      {/* The card's icon tile, heading, and supporting line all restated what
          the button already says once the count moves into its label. Radius
          steps down to --r-sm with the smaller type, per the Inkwell ladder. */}
      <button type="button"
        {...preventPersistedDisabledState}
        onClick={onFocusSchedule}
        disabled={scheduleCount === null}
        className="touch-target inline-flex shrink-0 items-center gap-2 rounded-sm bg-accent px-3 py-2 text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
      >
        <CalendarRangeIcon className="h-[15px] w-[15px] shrink-0" aria-hidden />
        {scheduleLabel(scheduleCount)}
        <kbd className="rounded-xs border border-on-accent/40 px-1.5 py-px font-mono text-[11px]" aria-label="Option 2">
          ⌥2
        </kbd>
      </button>
    </section>
  );
}
