import { Skeleton } from "@/components/ui/skeleton";

function StatsCardSkeleton() {
  return (
    <div
      className="rounded-2xl border-2 border-border/80 bg-card p-6"
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-14" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
      <div className="flex justify-center gap-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

function DonutSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <Skeleton className="h-5 w-44" />
      <div className="flex items-center justify-center py-4">
        <Skeleton className="h-[190px] w-[190px] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
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
