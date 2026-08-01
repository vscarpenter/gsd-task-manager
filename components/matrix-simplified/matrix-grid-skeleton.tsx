import { Skeleton } from "@/components/ui/skeleton";
import { quadrants } from "@/lib/quadrants";
import { QUADRANT_ACCENT } from "@/lib/quadrants";

/** Card placeholder counts per pane. Uneven on purpose — four identical columns
 *  read as a loading *pattern* rather than a preview of the real layout. */
const CARD_COUNT = [3, 2, 2, 1];

/**
 * Loading state for the matrix.
 *
 * Geometry mirrors <MatrixGrid> exactly (same grid gutter, pane radius, border,
 * ground, and header padding) so the swap to real content doesn't shift layout.
 * It exists because the empty states assert something specific — "Nothing on
 * fire." — which must not be shown before the read completes.
 */
export function MatrixGridSkeleton() {
  return (
    <div
      data-testid="matrix-grid-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading tasks"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:grid-rows-2"
    >
      {quadrants.map((meta, index) => (
        <section
          key={meta.id}
          className="relative flex min-h-[280px] flex-col rounded-lg border border-gray-200 bg-oat"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <header className="flex items-center gap-2 px-[18px] pb-2.5 pt-3.5">
            {/* The quadrant dot stays at full pigment: it is structure, not
                content, and is known before the data loads. */}
            <span
              aria-hidden
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: QUADRANT_ACCENT[meta.rdKey] }}
            />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="ml-auto h-3.5 w-6 rounded-full" />
          </header>
          <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-1">
            {Array.from({ length: CARD_COUNT[index] }).map((_, i) => (
              <div key={i} className="rounded-md border border-card-border bg-card p-3 pl-4">
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
