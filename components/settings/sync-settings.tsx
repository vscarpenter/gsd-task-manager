"use client";

import { useState, useEffect, useRef } from "react";
import { HistoryIcon, ZapIcon, ChevronRightIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getAutoSyncConfig, updateAutoSyncConfig } from "@/lib/sync/config";
import { toast } from "sonner";
import { createLogger } from "@/lib/logger";
import { SettingsRow, SettingsSelectRow } from "./shared-components";

const logger = createLogger("UI");

interface SyncSettingsProps {
	onViewHistory: () => void;
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
}: SyncSettingsProps) {
	const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
	const [syncInterval, setSyncInterval] = useState(2);
	const [isLoading, setIsLoading] = useState(false);
	const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		loadConfig();
	}, []);

	useEffect(() => {
		return () => {
			if (updateTimeoutRef.current) {
				clearTimeout(updateTimeoutRef.current);
			}
		};
	}, []);

	const loadConfig = async () => {
		try {
			const config = await getAutoSyncConfig();
			setAutoSyncEnabled(config.enabled);
			setSyncInterval(config.intervalMinutes);
		} catch (error) {
			logger.error("Failed to load sync config", error instanceof Error ? error : undefined);
		}
	};

	const handleAutoSyncToggle = async (checked: boolean) => {
		setIsLoading(true);
		try {
			await updateAutoSyncConfig(checked, syncInterval);
			setAutoSyncEnabled(checked);
			toast.success(checked ? 'Auto-sync enabled' : 'Auto-sync disabled');
		} catch (error) {
			logger.error("Failed to toggle auto-sync", error instanceof Error ? error : undefined);
			toast.error('Failed to update auto-sync settings');
		} finally {
			setIsLoading(false);
		}
	};

	const handleIntervalChange = async (value: string) => {
		const newInterval = parseInt(value);
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

	return (
		<>
			{/* Auto-Sync Toggle */}
			<SettingsRow label="Auto-sync" description="Sync changes in the background">
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
				onClick={onViewHistory}
				className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px]
				           text-left hover:bg-background-muted/50 transition-colors"
			>
				<HistoryIcon className="w-5 h-5 text-accent flex-shrink-0" />
				<span className="flex-1 text-sm font-medium text-foreground">Sync history</span>
				<ChevronRightIcon className="w-4 h-4 text-foreground-muted/50" />
			</button>
		</>
	);
}

