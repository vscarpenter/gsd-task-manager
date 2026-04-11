import { Skeleton } from "@/components/ui/skeleton";

function StatsCardSkeleton() {
  return (
    <div
      className="rounded-3xl border border-border/70 bg-card p-6"
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-9 w-14" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-12 w-12 rounded-2xl" />
      </div>
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 space-y-4" style={{ boxShadow: "var(--shadow-column)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  );
}

function DonutSkeleton() {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 space-y-4" style={{ boxShadow: "var(--shadow-column)" }}>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-4 w-44" />
      <div className="flex items-center justify-center py-4">
        <Skeleton className="h-[190px] w-[190px] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Row 1: Stats + Streak */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      {/* Row 2: Chart + Donut */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <DonutSkeleton />
      </div>
      {/* Row 3: Deadlines + Tags */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListSkeleton />
        <ListSkeleton />
      </div>
    </div>
  );
}
