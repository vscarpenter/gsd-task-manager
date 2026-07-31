import { Skeleton } from "@/components/ui/skeleton";
import { quadrants } from "@/lib/quadrants";
import { QUADRANT_ACCENT } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

const WASH_CLASS = ["quadrant-wash-q1", "quadrant-wash-q2", "quadrant-wash-q3", "quadrant-wash-q4"];
const POSITION_RULES = [
  "",
  "lg:border-l lg:border-border",
  "lg:border-t lg:border-border",
  "lg:border-l lg:border-t lg:border-border",
];

/** Card placeholder counts per pane. Uneven on purpose — four identical columns
 *  read as a loading *pattern* rather than a preview of the real layout. */
const CARD_COUNT = [3, 2, 2, 1];

/**
 * Loading state for the matrix.
 *
 * Geometry mirrors <MatrixGrid> exactly (same grid wrapper, pane borders, wash,
 * quadrant rule and header row) so the swap to real content doesn't shift
 * layout. It exists because the empty states assert something specific —
 * "Nothing on fire." — which must not be shown before the read completes.
 */
export function MatrixGridSkeleton() {
  return (
    <div
      data-testid="matrix-grid-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading tasks"
      className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:grid-rows-2 lg:gap-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-sm"
    >
      {quadrants.map((meta, index) => (
        <section
          key={meta.id}
          className={cn(
            "relative flex min-h-[280px] flex-col rounded-xl border border-border p-5",
            WASH_CLASS[index],
            "lg:rounded-none lg:border-0",
            POSITION_RULES[index]
          )}
        >
          {/* The quadrant rule stays at full pigment: it is structure, not
              content, and is known before the data loads. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[3px]"
            style={{
              backgroundColor: QUADRANT_ACCENT[meta.rdKey],
              borderTopLeftRadius: "inherit",
              borderTopRightRadius: "inherit",
            }}
          />
          <header className="-mx-5 -mt-5 mb-4 flex items-center gap-1.5 border-b border-border-muted px-5 py-3">
            <Skeleton className="h-[18px] w-[18px] rounded-md" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="ml-auto h-3.5 w-6 rounded" />
          </header>
          <div className="flex flex-1 flex-col gap-2">
            {Array.from({ length: CARD_COUNT[index] }).map((_, i) => (
              <div key={i} className="rounded-lg border border-card-border bg-card p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3.5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
