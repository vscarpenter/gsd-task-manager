"use client";

interface MatrixCaptionProps {
  active: number;
  completed: number;
  overdue: number;
  /** False until hydration, so the static export doesn't ship a count. */
  mounted: boolean;
}

/**
 * The three header pills.
 *
 * These describe whatever is currently on screen, filter included. Reporting the
 * whole database here while the board showed a filtered subset is what made a
 * narrowed board read as a broken one.
 */
export function MatrixCaption({ active, completed, overdue, mounted }: MatrixCaptionProps) {
  return (
    <>
      <span className="inline-flex items-center rounded-full bg-background-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground">
        {mounted ? `${active} active` : " "}
      </span>
      <span className="inline-flex items-center rounded-full bg-status-success-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-status-success-ink">
        {mounted ? `${completed} done` : " "}
      </span>
      {mounted && overdue > 0 ? (
        <span className="inline-flex items-center rounded-full bg-status-overdue-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-status-overdue-ink">
          {overdue} overdue
        </span>
      ) : null}
    </>
  );
}
