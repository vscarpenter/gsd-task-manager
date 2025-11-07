"use client";

import { useState, useEffect } from "react";
import { ChevronDownIcon, ArchiveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getArchiveSettings, updateArchiveSettings, archiveOldTasks, getArchivedCount } from "@/lib/archive";
import type { ArchiveSettings as ArchiveSettingsType } from "@/lib/types";
import { toast } from "sonner";

interface ArchiveSettingsProps {
	isExpanded: boolean;
	onToggle: () => void;
	onViewArchive: () => void;
}

export function ArchiveSettings({
	isExpanded,
	onToggle,
	onViewArchive,
}: ArchiveSettingsProps) {
	const [settings, setSettings] = useState<ArchiveSettingsType | null>(null);
	const [archivedCount, setArchivedCount] = useState(0);
	const [isArchiving, setIsArchiving] = useState(false);

	const loadSettings = async () => {
		const archiveSettings = await getArchiveSettings();
		setSettings(archiveSettings);
		const count = await getArchivedCount();
		setArchivedCount(count);
	};

	useEffect(() => {
		loadSettings();
	}, []);

	const handleToggleEnabled = async () => {
		if (!settings) return;

		const newEnabled = !settings.enabled;
		await updateArchiveSettings({ enabled: newEnabled });
		await loadSettings();

		toast.success(
			newEnabled
				? "Auto-archive enabled"
				: "Auto-archive disabled"
		);
	};

	const handleDaysChange = async (value: string) => {
		const days = parseInt(value) as 30 | 60 | 90;
		await updateArchiveSettings({ archiveAfterDays: days });
		await loadSettings();
		toast.success(`Archive period set to ${days} days`);
	};

	const handleArchiveNow = async () => {
		if (!settings) return;

		setIsArchiving(true);
		try {
			const count = await archiveOldTasks(settings.archiveAfterDays);
			await loadSettings(); // Refresh archived count
			toast.success(`Archived ${count} task${count !== 1 ? 's' : ''}`);
		} catch (err) {
			const errorMsg =
				err instanceof Error ? err.message : "Failed to archive tasks";
			toast.error(errorMsg);
		} finally {
			setIsArchiving(false);
		}
	};

	if (!settings) return null;

	return (
		<div className="rounded-lg border border-border bg-card">
			<button
				onClick={onToggle}
				className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-background-muted"
			>
				<div className="flex items-center gap-3">
					<ArchiveIcon className="h-5 w-5 text-foreground-muted" />
					<div>
						<h3 className="font-semibold text-foreground">
							Archive Settings
						</h3>
						<p className="text-sm text-foreground-muted">
							Auto-archive completed tasks
						</p>
					</div>
				</div>
				<ChevronDownIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${
						isExpanded ? "rotate-180" : ""
					}`}
				/>
			</button>

			{isExpanded && (
				<div className="space-y-4 border-t border-border p-4">
					{/* Enable/Disable Auto-Archive */}
					<div className="flex items-center justify-between gap-3">
						<div className="flex-1">
							<p className="text-sm font-medium text-foreground">
								Auto-Archive
							</p>
							<p className="text-xs text-foreground-muted">
								Automatically archive old completed tasks
							</p>
						</div>
						<Switch
							checked={settings.enabled}
							onCheckedChange={handleToggleEnabled}
						/>
					</div>

					{/* Archive After Days */}
					<div className="flex items-center justify-between gap-3">
						<div className="flex-1">
							<p className="text-sm font-medium text-foreground">
								Archive After
							</p>
							<p className="text-xs text-foreground-muted">
								Days after completion before archiving
							</p>
						</div>
						<Select
							value={settings.archiveAfterDays.toString()}
							onValueChange={handleDaysChange}
							disabled={!settings.enabled}
						>
							<SelectTrigger className="w-24">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="30">30 days</SelectItem>
								<SelectItem value="60">60 days</SelectItem>
								<SelectItem value="90">90 days</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Archive Now Button */}
					<div className="flex items-center justify-between gap-3 pt-2">
						<div className="flex-1">
							<p className="text-sm font-medium text-foreground">
								Archive Now
							</p>
							<p className="text-xs text-foreground-muted">
								Manually archive old completed tasks
							</p>
						</div>
						<Button
							variant="subtle"
							onClick={handleArchiveNow}
							disabled={isArchiving}
							className="text-sm h-auto py-1 px-3"
						>
							{isArchiving ? "Archiving..." : "Archive"}
						</Button>
					</div>

					{/* View Archive Link */}
					{archivedCount > 0 && (
						<div className="flex items-center justify-between gap-3 border-t border-border pt-4">
							<p className="text-sm text-foreground-muted">
								{archivedCount} archived task{archivedCount !== 1 ? 's' : ''}
							</p>
							<button
								onClick={onViewArchive}
								className="text-sm text-accent hover:underline"
							>
								View Archive
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
