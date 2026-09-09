"use client";

import { useState, useEffect, useRef } from "react";
import { HistoryIcon, ZapIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
	getAutoSyncConfig,
	updateAutoSyncConfig,
	getSyncStatus,
	disableSync,
} from "@/lib/sync/config";
import { toast } from "sonner";
import { createLogger } from "@/lib/logger";
import { SettingsRow, SettingsSelectRow } from "./shared-components";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { LogoutConfirmation } from "@/components/sync/sync-auth-dialog-sections";

const logger = createLogger("UI");

type SyncStatusSnapshot = Awaited<ReturnType<typeof getSyncStatus>>;

interface SyncSettingsProps {
	onViewHistory: () => void;
	/** Export tasks to a JSON backup (offered before account deletion). Resolves `true` on success. */
	onExport: () => Promise<boolean>;
	/** Called after a successful account deletion so the page can refresh sync state. */
	onAccountDeleted: () => void;
}

const SYNC_INTERVAL_OPTIONS = [
	{ value: "1", label: "1 minute" },
	{ value: "2", label: "2 minutes" },
	{ value: "5", label: "5 minutes" },
	{ value: "10", label: "10 minutes" },
	{ value: "15", label: "15 minutes" },
	{ value: "30", label: "30 minutes" },
];

/**
 * iOS-style sync settings
 */
export function SyncSettings({
	onViewHistory,
	onExport,
	onAccountDeleted,
}: SyncSettingsProps) {
	const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
	const [syncInterval, setSyncInterval] = useState(2);
	const [isLoading, setIsLoading] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot | null>(null);
	const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		void (async () => {
			try {
				const config = await getAutoSyncConfig();
				setAutoSyncEnabled(config.enabled);
				setSyncInterval(config.intervalMinutes);
			} catch (error) {
				logger.error("Failed to load sync config", error instanceof Error ? error : undefined);
			}
		})();
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				setSyncStatus(await getSyncStatus());
			} catch (error) {
				logger.error("Failed to load sync status", error instanceof Error ? error : undefined);
			}
		})();
	}, []);

	// react-doctor-disable-next-line react-doctor/exhaustive-deps -- cleanup intentionally reads the latest ref value at unmount
	useEffect(() => {
		// Clear any pending debounced interval update on unmount. Reading the
		// latest timeout id at cleanup time is the intended behavior here.
		return () => {
			if (updateTimeoutRef.current) {
				clearTimeout(updateTimeoutRef.current);
			}
		};
	}, []);

	const handleAutoSyncToggle = async (checked: boolean) => {
		// No `finally`: the React Compiler can't yet optimize a component with a
		// try/finally, so the loading reset is duplicated across both paths.
		setIsLoading(true);
		try {
			await updateAutoSyncConfig(checked, syncInterval);
			setAutoSyncEnabled(checked);
			toast.success(checked ? 'Auto-sync enabled' : 'Auto-sync disabled');
			setIsLoading(false);
		} catch (error) {
			logger.error("Failed to toggle auto-sync", error instanceof Error ? error : undefined);
			toast.error('Failed to update auto-sync settings');
			setIsLoading(false);
		}
	};

	const handleIntervalChange = async (value: string) => {
		const newInterval = Number.parseInt(value, 10);
		setSyncInterval(newInterval);

		if (updateTimeoutRef.current) {
			clearTimeout(updateTimeoutRef.current);
		}

		updateTimeoutRef.current = setTimeout(async () => {
			try {
				await updateAutoSyncConfig(autoSyncEnabled, newInterval);
				toast.success(`Sync interval set to ${newInterval} minute${newInterval !== 1 ? 's' : ''}`);
			} catch (error) {
				logger.error("Failed to update sync interval", error instanceof Error ? error : undefined);
				toast.error('Failed to update sync interval');
			}
		}, 500);
	};

	const currentInterval = SYNC_INTERVAL_OPTIONS.find(
		opt => opt.value === syncInterval.toString()
	);

	async function handleSignOut() {
		// Re-read rather than trust the mounted snapshot: the queue may have
		// filled since this page loaded.
		const status = await getSyncStatus();
		setSyncStatus(status);
		if (status.pendingCount > 0) {
			setShowSignOutConfirm(true);
			return;
		}
		await performSignOut();
	}

	async function performSignOut() {
		setIsSigningOut(true);
		try {
			await disableSync();
			setSyncStatus((prev) =>
				prev ? { ...prev, enabled: false, email: null, pendingCount: 0 } : prev,
			);
			setShowSignOutConfirm(false);
			toast.success("Signed out");
		} catch (error) {
			logger.error("Sign out failed", error instanceof Error ? error : undefined);
			toast.error("Sign out failed");
		} finally {
			setIsSigningOut(false);
		}
	}

	return (
		<>
			{/* Auto-Sync Toggle */}
			<SettingsRow
				label="Auto-sync"
				description="Sync changes in the background"
				state={autoSyncEnabled}
			>
				<Switch
					checked={autoSyncEnabled}
					onCheckedChange={handleAutoSyncToggle}
					disabled={isLoading}
				/>
			</SettingsRow>

			{/* Sync Interval */}
			{autoSyncEnabled && (
				<SettingsSelectRow
					label="Sync interval"
					value={currentInterval?.label || "2 minutes"}
					options={SYNC_INTERVAL_OPTIONS}
					onChange={handleIntervalChange}
				/>
			)}

			{/* Smart Sync Info */}
			{autoSyncEnabled && (
				<div className="px-4 py-3.5">
					<div className="flex items-start gap-3 p-3 bg-background-muted/50 rounded-lg">
						<ZapIcon className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
						<div className="text-xs text-foreground-muted space-y-1">
							<p className="font-medium text-foreground">Smart triggers</p>
							<ul className="space-y-0.5">
								<li>• When returning to this tab</li>
								<li>• When reconnecting to internet</li>
								<li>• 30s after making changes</li>
							</ul>
						</div>
					</div>
				</div>
			)}

			{/* View History */}
			<button
				type="button"
				onClick={onViewHistory}
				className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px]
				           text-left hover:bg-background-muted/50 transition-colors"
			>
				<HistoryIcon className="w-5 h-5 text-accent flex-shrink-0" />
				<span className="flex-1 text-sm font-medium text-foreground">Sync history</span>
				<ChevronRightIcon className="w-4 h-4 text-foreground-muted/50" />
			</button>

			{/* Account */}
			{syncStatus?.enabled && (
				<>
					<SettingsRow label="Account" description={syncStatus.email ?? undefined}>
						<Button
							variant="subtle"
							onClick={handleSignOut}
							disabled={isSigningOut}
						>
							{isSigningOut ? "Signing out…" : "Sign out"}
						</Button>
					</SettingsRow>

					{showSignOutConfirm && (
						<div className="px-4 pb-3.5">
							<LogoutConfirmation
								pendingChanges={syncStatus.pendingCount}
								isLoading={isSigningOut}
								onCancel={() => setShowSignOutConfirm(false)}
								onConfirm={performSignOut}
							/>
						</div>
					)}
				</>
			)}

			{/* Danger zone */}
			<div className="px-4 py-3.5">
				<div className="rounded-lg border border-status-overdue/35 bg-status-overdue-muted/40 p-4 space-y-3">
					<div>
						<p className="text-sm font-semibold text-status-overdue-ink">Danger zone</p>
						<p className="text-xs text-foreground-muted mt-1">
							Permanently delete your account and every task synced to it. This
							cannot be undone.
						</p>
					</div>
					<Button
						variant="destructive"
						onClick={() => setDeleteDialogOpen(true)}
						className="w-full sm:w-auto"
					>
						<Trash2Icon className="mr-2 h-4 w-4" />
						Delete account…
					</Button>
				</div>
			</div>

			<DeleteAccountDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onExport={onExport}
				onDeleted={onAccountDeleted}
			/>
		</>
	);
}
