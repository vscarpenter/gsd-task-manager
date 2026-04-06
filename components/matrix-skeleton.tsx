import { Skeleton } from "@/components/ui/skeleton";

function SkeletonTaskCard() {
  return (
    <div className="rounded-xl border border-card-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <Skeleton className="h-4 w-4 rounded shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-7 w-7 rounded-full shrink-0" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <div className="flex gap-1">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-3 rounded" />
        </div>
      </div>
    </div>
  );
}

function SkeletonColumn({ bgClass, taskCount = 3 }: { bgClass: string; taskCount?: number }) {
  return (
    <div className={`matrix-card ${bgClass}`}>
      <div className="matrix-card__header">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-6 w-8 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: taskCount }, (_, i) => (
          <SkeletonTaskCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function MatrixSkeleton() {
  return (
    <div className="matrix-grid">
      <SkeletonColumn bgClass="bg-quadrant-focus" taskCount={3} />
      <SkeletonColumn bgClass="bg-quadrant-schedule" taskCount={2} />
      <SkeletonColumn bgClass="bg-quadrant-delegate" taskCount={2} />
      <SkeletonColumn bgClass="bg-quadrant-eliminate" taskCount={1} />
    </div>
  );
}
