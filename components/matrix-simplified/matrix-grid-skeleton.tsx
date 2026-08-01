import { CalendarIcon, FlameIcon, Trash2Icon, UsersIcon, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  quadrants,
  QUADRANT_ACCENT,
  QUADRANT_HEADER,
  QUADRANT_INK,
  QUADRANT_WASH,
  type QuadrantMeta,
  type RedesignIconKey,
} from "@/lib/quadrants";

/** Card placeholder counts per pane. Uneven on purpose — four identical columns
 *  read as a loading *pattern* rather than a preview of the real layout. */
const CARD_COUNT = [3, 2, 2, 1];

const QUADRANT_ICON: Record<RedesignIconKey, LucideIcon> = {
  flame: FlameIcon,
  calendar: CalendarIcon,
  users: UsersIcon,
  trash: Trash2Icon,
};

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
        <QuadrantSkeleton key={meta.id} meta={meta} cardCount={CARD_COUNT[index]} />
      ))}
    </div>
  );
}

function QuadrantSkeleton({ meta, cardCount }: { meta: QuadrantMeta; cardCount: number }) {
  const Icon = QUADRANT_ICON[meta.rdIcon];
  return (
    <section
      className="relative flex min-h-[280px] flex-col overflow-hidden rounded-lg border border-pane-border"
      style={{ boxShadow: "var(--shadow-card)", backgroundColor: QUADRANT_WASH[meta.rdKey] }}
    >
      <header
        className="flex items-center gap-2 border-t-[3px] px-[18px] pb-2.5 pt-3"
        style={{ backgroundColor: QUADRANT_HEADER[meta.rdKey], borderTopColor: QUADRANT_ACCENT[meta.rdKey] }}
      >
        <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" style={{ color: QUADRANT_INK[meta.rdKey] }} />
        <span className="text-[14px] font-semibold leading-none" style={{ color: QUADRANT_INK[meta.rdKey] }}>
          {meta.title}
        </span>
        <Skeleton className="ml-auto h-3.5 w-6 rounded-full" />
      </header>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-1">
        {Array.from({ length: cardCount }).map((_, cardIndex) => (
          <div key={cardIndex} className="rounded-md border border-card-border bg-card p-3 pl-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3.5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
