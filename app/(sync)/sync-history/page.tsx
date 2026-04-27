"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2Icon, XCircleIcon, AlertTriangleIcon, ClockIcon, CloudIcon, UserIcon } from "lucide-react";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { Button } from "@/components/ui/button";
import { getRecentHistory, getHistoryStats, clearHistory } from "@/lib/sync-history";
import type { SyncHistoryRecord } from "@/lib/types";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const HISTORY_KEY = ["syncHistory"] as const;
const STATS_KEY = ["syncHistoryStats"] as const;
const ESTIMATED_ROW_HEIGHT = 120;
const ROW_GAP = 16;

function getStatusIcon(status: SyncHistoryRecord["status"]) {
	switch (status) {
		case "success":
			return <CheckCircle2Icon className="h-5 w-5 text-green-600" />;
		case "error":
			return <XCircleIcon className="h-5 w-5 text-red-600" />;
		case "conflict":
			return <AlertTriangleIcon className="h-5 w-5 text-amber-600" />;
	}
}

function getStatusColor(status: SyncHistoryRecord["status"]): string {
	switch (status) {
		case "success":
			return "bg-green-50 border-green-200";
		case "error":
			return "bg-red-50 border-red-200";
		case "conflict":
			return "bg-amber-50 border-amber-200";
	}
}

export default function SyncHistoryPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	const { data: history = [], isLoading } = useQuery({
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
			const errorMsg = err instanceof Error ? err.message : "Failed to clear history";
			toast.error(errorMsg);
		},
	});

	const handleClearHistory = () => {
		if (!confirm("Clear all sync history? This cannot be undone.")) {
			return;
		}
		clearMutation.mutate();
	};

	const virtualizer = useVirtualizer({
		count: history.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: () => ESTIMATED_ROW_HEIGHT + ROW_GAP,
		overscan: 5,
	});

	return (
		<AppShell
			title="Sync history"
			caption={`${history.length} sync operation${history.length !== 1 ? "s" : ""}`}
			topbarRightSlot={
				history.length > 0 ? (
					<Button
						variant="subtle"
						onClick={handleClearHistory}
						className="text-sm"
					>
						Clear History
					</Button>
				) : undefined
			}
		>
			<div className="pb-8">
				{stats && history.length > 0 && (
					<div className="mb-8 grid gap-4 md:grid-cols-4">
						<div className="rounded-lg border border-border bg-background-muted p-4">
							<div className="text-sm text-foreground-muted">Total Syncs</div>
							<div className="text-2xl font-semibold text-foreground">{stats.totalSyncs}</div>
						</div>
						<div className="rounded-lg border border-border bg-background-muted p-4">
							<div className="text-sm text-foreground-muted">Successful</div>
							<div className="text-2xl font-semibold text-green-600">{stats.successfulSyncs}</div>
						</div>
						<div className="rounded-lg border border-border bg-background-muted p-4">
							<div className="text-sm text-foreground-muted">Tasks Pushed</div>
							<div className="text-2xl font-semibold text-foreground">{stats.totalPushed}</div>
						</div>
						<div className="rounded-lg border border-border bg-background-muted p-4">
							<div className="text-sm text-foreground-muted">Tasks Pulled</div>
							<div className="text-2xl font-semibold text-foreground">{stats.totalPulled}</div>
						</div>
					</div>
				)}

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<p className="text-foreground-muted">Loading sync history...</p>
					</div>
				) : history.length === 0 ? (
					<div className="mx-auto max-w-xl rounded-3xl border border-border bg-background-muted p-8 text-center">
						<h2 className="text-lg font-semibold text-foreground">
							No sync history yet
						</h2>
						<p className="mt-2 text-sm text-foreground-muted">
							Your sync operations will appear here once you enable cloud sync.
						</p>
						<Button
							variant="primary"
							className="mt-4"
							onClick={() => router.push("/")}
						>
							Back to Tasks
						</Button>
					</div>
				) : (
					<div
						ref={scrollContainerRef}
						className="overflow-auto"
						style={{ height: "70vh" }}
					>
						<div
							style={{
								height: `${virtualizer.getTotalSize()}px`,
								width: "100%",
								position: "relative",
							}}
						>
							{virtualizer.getVirtualItems().map((virtualRow) => {
								const record = history[virtualRow.index];
								return (
									<div
										key={virtualRow.key}
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											width: "100%",
											height: `${virtualRow.size}px`,
											transform: `translateY(${virtualRow.start}px)`,
										}}
									>
										<div className={`rounded-lg border p-4 ${getStatusColor(record.status)}`}>
											<div className="flex items-start justify-between gap-4">
												<div className="flex items-start gap-3">
													{getStatusIcon(record.status)}
													<div className="flex-1">
														<div className="flex items-center gap-2">
															<h3 className="font-medium text-foreground capitalize">
																{record.status === "conflict" ? "Sync with Conflicts" : `${record.status} Sync`}
															</h3>
															<span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
																{record.triggeredBy === "user" ? (
																	<>
																		<UserIcon className="h-3 w-3" />
																		Manual
																	</>
																) : (
																	<>
																		<CloudIcon className="h-3 w-3" />
																		Auto
																	</>
																)}
															</span>
														</div>

														<div className="mt-1 flex items-center gap-1 text-sm text-foreground-muted">
															<ClockIcon className="h-3 w-3" />
															{formatDistanceToNow(new Date(record.timestamp), { addSuffix: true })}
														</div>

														<div className="mt-2 flex flex-wrap gap-4 text-sm">
															{record.pushedCount > 0 && (
																<span className="text-foreground-muted">
																	<span className="font-medium text-foreground">{record.pushedCount}</span> pushed
																</span>
															)}
															{record.pulledCount > 0 && (
																<span className="text-foreground-muted">
																	<span className="font-medium text-foreground">{record.pulledCount}</span> pulled
																</span>
															)}
															{record.conflictsResolved > 0 && (
																<span className="text-foreground-muted">
																	<span className="font-medium text-amber-600">{record.conflictsResolved}</span> conflicts resolved
																</span>
															)}
															{record.duration && (
																<span className="text-foreground-muted">
																	{record.duration}ms
																</span>
															)}
														</div>

														{record.errorMessage && (
															<div className="mt-2 rounded bg-red-100 p-2 text-sm text-red-700">
																{record.errorMessage}
															</div>
														)}
													</div>
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</AppShell>
	);
}
