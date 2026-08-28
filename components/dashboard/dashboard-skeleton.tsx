import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeletons mirror the geometry they replace, so the page does not reflow when
 * the local read resolves. Each block below is measured against its real
 * counterpart rather than being a generic grey box.
 */

/** Two serif lines: the verdict lead (32px) and its observation (19px). */
export function VerdictSkeleton() {
  return (
    <div className="max-w-[34rem] space-y-3" aria-hidden="true">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-5 w-3/4" />
    </div>
  );
}

/** Three borderless rail measures behind hairline dividers. */
export function StatRailSkeleton() {
  return (
    <div
      className="mt-8 grid gap-6 border-t border-border/70 pt-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/70"
      aria-hidden="true"
    >
      {["closed", "active", "follow-through"].map((key, i) => (
        <div key={key} className={i === 0 ? "sm:pr-6" : i === 1 ? "sm:px-6" : "sm:pl-6"}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-10 w-16" />
          <Skeleton className="mt-2 h-3 w-40" />
          <Skeleton className="mt-3 h-7 w-full" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="space-y-4 rounded-lg border-hair border-border bg-card p-6"
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  );
}

/** Segmented bar plus its four-row legend — not a donut. */
function DistributionSkeleton() {
  return (
    <div
      className="space-y-5 rounded-lg border-hair border-border bg-card p-6"
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}

function StreakSkeleton() {
  return (
    <div
      className="rounded-lg border-hair border-border bg-card p-6"
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-10 w-20" />
      <div className="mt-4 flex items-center gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-6 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-3 w-24" />
    </div>
  );
}

/** The three-column reflection band, which is ruled rather than carded. */
function PromptsSkeleton() {
  return (
    <div className="space-y-5 border-y border-border/70 py-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-72" />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border-hair border-border bg-card p-6 shadow-sm">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Evidence row: trend chart beside the distribution and streak stack */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div className="space-y-6">
          <DistributionSkeleton />
          <StreakSkeleton />
        </div>
      </div>
      <PromptsSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <ListSkeleton />
        <ListSkeleton />
      </div>
    </div>
  );
}
