"use client";

import { useState, useEffect, useRef } from "react";
import { CloudIcon, ChevronRightIcon, HistoryIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getAutoSyncConfig, updateAutoSyncConfig } from "@/lib/sync/config";
import { toast } from "sonner";

interface SyncSettingsProps {
	isExpanded: boolean;
	onToggle: () => void;
	onViewHistory: () => void;
}

export function SyncSettings({
	isExpanded,
	onToggle,
	onViewHistory,
}: SyncSettingsProps) {
	const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
	const [syncInterval, setSyncInterval] = useState(2);
	const [isLoading, setIsLoading] = useState(false);

	// Load auto-sync config on mount
	useEffect(() => {
		loadConfig();
	}, []);

	const loadConfig = async () => {
		try {
			const config = await getAutoSyncConfig();
			setAutoSyncEnabled(config.enabled);
			setSyncInterval(config.intervalMinutes);
		} catch (error) {
			console.error('[SYNC SETTINGS] Failed to load config:', error);
		}
	};

	const handleAutoSyncToggle = async (checked: boolean) => {
		setIsLoading(true);
		try {
			await updateAutoSyncConfig(checked, syncInterval);
			setAutoSyncEnabled(checked);
			toast.success(checked ? 'Auto-sync enabled' : 'Auto-sync disabled');
		} catch (error) {
			console.error('[SYNC SETTINGS] Failed to toggle auto-sync:', error);
			toast.error('Failed to update auto-sync settings');
		} finally {
			setIsLoading(false);
		}
	};

	const handleIntervalChange = async (value: number) => {
		// Clamp value to valid range
		const clampedValue = Math.max(1, Math.min(30, value));
		setSyncInterval(clampedValue);

		// Debounce the actual update
		if (updateTimeoutRef.current) {
			clearTimeout(updateTimeoutRef.current);
		}

		updateTimeoutRef.current = setTimeout(async () => {
			try {
				await updateAutoSyncConfig(autoSyncEnabled, clampedValue);
				toast.success(`Sync interval set to ${clampedValue} minute${clampedValue !== 1 ? 's' : ''}`);
			} catch (error) {
				console.error('[SYNC SETTINGS] Failed to update interval:', error);
				toast.error('Failed to update sync interval');
			}
		}, 1000); // Wait 1 second after user stops typing
	};

	const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (updateTimeoutRef.current) {
				clearTimeout(updateTimeoutRef.current);
			}
		};
	}, []);

	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
				<div className="flex items-center gap-3">
					<CloudIcon className="h-5 w-5 text-accent" />
					<span className="font-semibold text-foreground">Cloud Sync</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${isExpanded ? "rotate-90" : ""
						}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4 space-y-6">
				{/* Auto-Sync Settings */}
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="auto-sync-toggle" className="text-sm font-medium">
								Automatic Sync
							</Label>
							<p className="text-xs text-foreground-muted">
								Sync changes automatically in the background
							</p>
						</div>
						<Switch
							id="auto-sync-toggle"
							checked={autoSyncEnabled}
							onCheckedChange={handleAutoSyncToggle}
							disabled={isLoading}
						/>
					</div>

					{/* Sync Interval Selector */}
					{autoSyncEnabled && (
						<div className="space-y-2 pl-2 border-l-2 border-accent/20">
							<Label htmlFor="sync-interval" className="text-sm font-medium">
								Sync Interval: {syncInterval} minute{syncInterval !== 1 ? 's' : ''}
							</Label>
							<div className="flex items-center gap-2">
								<input
									id="sync-interval"
									type="range"
									min="1"
									max="30"
									step="1"
									value={syncInterval}
									onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
									className="flex-1 h-2 bg-background-muted rounded-lg appearance-none cursor-pointer accent-accent"
								/>
								<input
									type="number"
									min="1"
									max="30"
									value={syncInterval}
									onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
									className="w-16 px-2 py-1 text-sm bg-background-muted border border-foreground-muted/20 rounded text-center"
								/>
							</div>
							<p className="text-xs text-foreground-muted">
								Changes sync every {syncInterval} minute{syncInterval !== 1 ? 's' : ''} when pending
							</p>

							{/* Auto-sync triggers info */}
							<div className="mt-3 p-3 bg-background-muted/50 rounded-lg space-y-1.5">
								<div className="flex items-start gap-2">
									<ZapIcon className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
									<p className="text-xs text-foreground-muted">
										Auto-sync also triggers when:
									</p>
								</div>
								<ul className="text-xs text-foreground-muted space-y-1 pl-5">
									<li>• Returning to this tab after being away</li>
									<li>• Reconnecting to the internet</li>
									<li>• 30 seconds after making changes</li>
								</ul>
								<p className="text-xs text-foreground-muted mt-2 pt-2 border-t border-foreground-muted/10">
									Manual sync button always available for instant sync
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Sync History */}
				<div className="space-y-2 pt-2 border-t border-foreground-muted/10">
					<Button
						variant="subtle"
						className="w-full justify-start"
						onClick={onViewHistory}
					>
						<HistoryIcon className="mr-2 h-4 w-4" />
						View Sync History
					</Button>
					<p className="text-xs text-foreground-muted px-2">
						View past sync operations, including pushed and pulled tasks,
						conflicts resolved, and errors.
					</p>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
