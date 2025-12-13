"use client";

import { useState, useEffect } from "react";
import { ChevronRightIcon, ArchiveIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getArchiveSettings, updateArchiveSettings, archiveOldTasks, getArchivedCount } from "@/lib/archive";
import type { ArchiveSettings as ArchiveSettingsType } from "@/lib/types";
import { toast } from "sonner";
import { SettingsRow, SettingsSelectRow } from "./shared-components";

interface ArchiveSettingsProps {
	onViewArchive: () => void;
}

const ARCHIVE_DAYS_OPTIONS = [
	{ value: "30", label: "30 days" },
	{ value: "60", label: "60 days" },
	{ value: "90", label: "90 days" },
];

/**
 * iOS-style archive settings
 */
export function ArchiveSettings({
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
		const days = Number.parseInt(value, 10) as 30 | 60 | 90;
		await updateArchiveSettings({ archiveAfterDays: days });
		await loadSettings();
		toast.success(`Archive period set to ${days} days`);
	};

	const handleArchiveNow = async () => {
		if (!settings) return;

		setIsArchiving(true);
		try {
			const count = await archiveOldTasks(settings.archiveAfterDays);
			await loadSettings();
			toast.success(`Archived ${count} task${count !== 1 ? 's' : ''}`);
		} catch (err) {
			const errorMsg =
				err instanceof Error ? err.message : "Failed to archive tasks";
			toast.error(errorMsg);
		} finally {
			setIsArchiving(false);
		}
	};

	if (!settings) {
		return (
			<div className="px-4 py-3.5">
				<p className="text-sm text-foreground-muted">Loading...</p>
			</div>
		);
	}

	const currentDays = ARCHIVE_DAYS_OPTIONS.find(
		opt => opt.value === settings.archiveAfterDays.toString()
	);

	return (
		<>
			{/* Auto-Archive Toggle */}
			<SettingsRow label="Auto-archive" description="Archive old completed tasks">
				<Switch
					checked={settings.enabled}
					onCheckedChange={handleToggleEnabled}
				/>
			</SettingsRow>

			{/* Archive After Days */}
			{settings.enabled && (
				<SettingsSelectRow
					label="Archive after"
					value={currentDays?.label || "30 days"}
					options={ARCHIVE_DAYS_OPTIONS}
					onChange={handleDaysChange}
				/>
			)}

			{/* Archive Now Action */}
			<ActionRow
				icon={ArchiveIcon}
				label="Archive now"
				description="Manually archive completed tasks"
				onClick={handleArchiveNow}
				disabled={isArchiving}
				actionLabel={isArchiving ? "Archiving..." : "Run"}
			/>

			{/* View Archive Link */}
			{archivedCount > 0 && (
				<button
					onClick={onViewArchive}
					className="w-full flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]
					           text-left hover:bg-background-muted/50 transition-colors"
				>
					<div className="flex items-center gap-3">
						<span className="text-sm font-medium text-foreground">View archive</span>
						<span className="text-xs text-foreground-muted">
							{archivedCount} task{archivedCount !== 1 ? 's' : ''}
						</span>
					</div>
					<ChevronRightIcon className="w-4 h-4 text-foreground-muted/50" />
				</button>
			)}
		</>
	);
}

/**
 * Action row with button (unique to archive settings)
 */
function ActionRow({
	icon: Icon,
	label,
	description,
	onClick,
	disabled,
	actionLabel,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	description?: string;
	onClick: () => void;
	disabled?: boolean;
	actionLabel: string;
}) {
	return (
		<div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
			<Icon className="w-5 h-5 text-accent flex-shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground">{label}</p>
				{description && (
					<p className="text-xs text-foreground-muted mt-0.5">{description}</p>
				)}
			</div>
			<button
				onClick={onClick}
				disabled={disabled}
				className="px-3 py-1.5 text-xs font-medium text-accent bg-accent/10
				           rounded-lg hover:bg-accent/20 transition-colors
				           disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{actionLabel}
			</button>
		</div>
	);
}
