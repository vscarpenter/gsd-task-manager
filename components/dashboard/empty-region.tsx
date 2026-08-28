import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Empty state for a data region inside the review.
 *
 * One line naming why the region is blank, then one route back to where the
 * work actually happens. Three regions need exactly this, which is where the
 * helper earns its keep rather than being a premature abstraction.
 *
 * The label is "Open matrix" everywhere on purpose: it is one intent, and two
 * labels for one intent is the template tell.
 *
 * touch-target is not decoration: this is a standalone block link, so WCAG's
 * inline-text exception does not apply and it must clear the 44px floor the
 * brief sets for coarse pointers. It needs inline-flex for the min-height to
 * take effect on an anchor.
 */
export function EmptyRegion({ line, className }: { line: string; className?: string }): React.ReactElement {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 text-center", className)}>
      <p className="text-sm leading-relaxed text-foreground-muted">{line}</p>
      <Link
        href={ROUTES.HOME}
        className="touch-target inline-flex items-center justify-center rounded-sm px-2 text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Open matrix
      </Link>
    </div>
  );
}
