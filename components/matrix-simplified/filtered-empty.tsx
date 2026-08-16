"use client";

import { SearchXIcon } from "lucide-react";

interface FilteredEmptyProps {
  /** The search text, when the board was narrowed by search. */
  query: string;
  /** The active smart view's name, when one is applied. */
  viewName?: string | null;
  onClear: () => void;
}

/**
 * Shown when a filter matched nothing.
 *
 * Without it the four quadrants fall back to their default copy — "Nothing on
 * fire.", "Stay sharp." — which asserts something about the user's workload
 * rather than about their search. Combined with a header count for the whole
 * board, a filtered board read as a board that had vanished.
 */
export function FilteredEmpty({ query, viewName, onClear }: FilteredEmptyProps) {
  const label = query.trim() ? `“${query.trim()}”` : viewName;

  return (
    <div
      data-testid="filtered-empty"
      className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-pane-border bg-card/60 px-6 py-16 text-center"
    >
      <SearchXIcon className="h-6 w-6 text-foreground-muted" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-h3 text-foreground">No tasks match {label}</p>
        <p className="text-sm text-foreground-muted">
          Your tasks are still here — this view is just narrowed.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="touch-target rounded-full border border-pane-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {query.trim() ? "Clear search" : "Clear filter"}
      </button>
    </div>
  );
}
