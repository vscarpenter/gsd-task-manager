"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, XCircleIcon, AlertTriangleIcon, ClockIcon, CloudIcon, UserIcon } from "lucide-react";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { Button } from "@/components/ui/button";
import { getRecentHistory, getHistoryStats, clearHistory } from "@/lib/sync-history";
import type { SyncHistoryRecord } from "@/lib/types";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { TOAST_DURATION } from "@/lib/constants";

const HISTORY_KEY = ["syncHistory"] as const;
const STATS_KEY = ["syncHistoryStats"] as const;
const STATUS_LABELS: Record<SyncHistoryRecord["status"], string> = {
  success: "Sync complete",
  error: "Sync failed",
  conflict: "Sync with conflicts",
  partial: "Partial sync",
};

function getStatusIcon(status: SyncHistoryRecord["status"]): React.ReactElement | null {
  switch (status) {
    case "success": return <CheckCircle2Icon aria-hidden="true" className="size-5 shrink-0 text-status-success" />;
    case "error": return <XCircleIcon aria-hidden="true" className="size-5 shrink-0 text-status-overdue" />;
    case "conflict": return <AlertTriangleIcon aria-hidden="true" className="size-5 shrink-0 text-status-blocked" />;
    case "partial": return <AlertTriangleIcon aria-hidden="true" className="size-5 shrink-0 text-status-blocking" />;
  }
}

function getStatusColor(status: SyncHistoryRecord["status"]): string {
  switch (status) {
    case "success": return "border-status-success/45 bg-status-success-muted";
    case "error": return "border-status-overdue/45 bg-status-overdue-muted";
    case "conflict": return "border-status-blocked/45 bg-status-blocked-muted";
    case "partial": return "border-status-blocking/45 bg-status-blocking-muted";
  }
}

interface SyncStatsData {
  totalSyncs: number;
  successfulSyncs: number;
  totalPushed: number;
  totalPulled: number;
}

function SyncHistoryStats({ stats }: { stats: SyncStatsData }): React.ReactElement {
  const measures = [
    { label: "Total syncs", count: stats.totalSyncs },
    { label: "Successful", count: stats.successfulSyncs },
    { label: "Tasks pushed", count: stats.totalPushed },
    { label: "Tasks pulled", count: stats.totalPulled },
  ];
  return (
    <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-3 sm:grid-cols-4">
      {measures.map(({ label, count }) => (
        <div key={label}>
          <dt className="text-small text-foreground-muted">{label}</dt>
          <dd className="text-h3 tabular-nums text-foreground">{count}</dd>
        </div>
      ))}
    </dl>
  );
}

function SyncHistoryRow({ record }: { record: SyncHistoryRecord }): React.ReactElement {
  return (
    <li className={`flex items-start gap-3 rounded-md border p-4 ${getStatusColor(record.status)}`}>
      {getStatusIcon(record.status)}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-medium text-foreground">{STATUS_LABELS[record.status]}</h3>
          <span className="inline-flex items-center gap-1 text-caption text-gray-700">
            {record.triggeredBy === "user"
              ? <><UserIcon className="size-3" aria-hidden="true" />Manual</>
              : <><CloudIcon className="size-3" aria-hidden="true" />Auto</>}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-small text-gray-700">
          <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
          <time dateTime={record.timestamp}>{formatDistanceToNow(new Date(record.timestamp), { addSuffix: true })}</time>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small tabular-nums text-gray-700 empty:hidden">
          {record.pushedCount > 0 && <span>{record.pushedCount} pushed</span>}
          {record.pulledCount > 0 && <span>{record.pulledCount} pulled</span>}
          {record.conflictsResolved > 0 && <span className="text-status-blocked-ink">{record.conflictsResolved} conflicts resolved</span>}
          {Boolean(record.failedCount) && <span className="text-status-overdue-ink">{record.failedCount} failed</span>}
          {record.duration !== undefined && <span>{record.duration} ms</span>}
        </div>
        {record.errorMessage && (
          <p className="mt-2 text-small text-status-overdue-ink [overflow-wrap:anywhere]">{record.errorMessage}</p>
        )}
      </div>
    </li>
  );
}

export default function SyncHistoryPage(): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading, isError, refetch } = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => getRecentHistory(50),
  });

  const { data: stats = null } = useQuery({
    queryKey: STATS_KEY,
    queryFn: getHistoryStats,
  });

  const clearMutation = useMutation({
    mutationFn: clearHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      toast.success("Sync history cleared");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clear history");
    },
  });

  const handleClearHistory = (): void => {
    // Use a confirmation toast instead of window.confirm to stay non-blocking
    toast("Clear all sync history? This cannot be undone.", {
      duration: TOAST_DURATION.LONG,
      action: { label: "Clear", onClick: () => clearMutation.mutate() },
    });
  };

  return (
    <AppShell title="Sync history">
      <div className="pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-foreground-muted">Loading sync history...</p>
          </div>
        ) : isError && history.length === 0 ? (
          <div className="py-12 text-center">
            <p role="alert" className="text-foreground-muted">Could not load sync history.</p>
            <Button variant="subtle" onClick={() => void refetch()} className="touch-target mt-4">Try again</Button>
          </div>
        ) : history.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-border bg-background-muted p-8 text-center">
            <h2 className="text-h3 text-foreground">No sync history yet</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Your sync operations will appear here once you enable cloud sync.
            </p>
            <Button variant="primary" className="mt-4" onClick={() => router.push("/")}>
              Open matrix
            </Button>
          </div>
        ) : (
          <section aria-labelledby="recent-sync-operations">
            {stats && <SyncHistoryStats stats={stats} />}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="recent-sync-operations" className="text-h3">Recent operations</h2>
                {stats && stats.totalSyncs > history.length && (
                  <p className="text-caption text-foreground-muted">Showing {history.length} of {stats.totalSyncs} operations</p>
                )}
              </div>
              <Button variant="ghost" onClick={handleClearHistory} className="touch-target text-small text-foreground-muted">
                Clear history
              </Button>
            </div>
            <ol role="list" className="space-y-3">
              {history.map((record) => <SyncHistoryRow key={record.id} record={record} />)}
            </ol>
          </section>
        )}
      </div>
    </AppShell>
  );
}
