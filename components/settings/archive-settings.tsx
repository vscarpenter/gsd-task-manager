"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRightIcon, ArchiveIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getArchiveSettings, updateArchiveSettings, archiveOldTasks, getArchivedCount } from "@/lib/archive";
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

// Pure handler (no component state) — kept at module scope.
async function handleDaysChange(value: string): Promise<void> {
	const days = Number.parseInt(value, 10) as 30 | 60 | 90;
	await updateArchiveSettings({ archiveAfterDays: days });
	toast.success(`Archive period set to ${days} days`);
}

/**
 * iOS-style archive settings
 */
export function ArchiveSettings({
	onViewArchive,
}: ArchiveSettingsProps) {
	// Live Dexie queries auto-refresh when the underlying tables change, so no
	// load-on-mount effect or manual reload is needed after mutations.
	const settings = useLiveQuery(() => getArchiveSettings());
	const archivedCount = useLiveQuery(() => getArchivedCount()) ?? 0;
	const [isArchiving, setIsArchiving] = useState(false);

	const handleToggleEnabled = async () => {
		if (!settings) return;

		const newEnabled = !settings.enabled;
		await updateArchiveSettings({ enabled: newEnabled });

		toast.success(
			newEnabled
				? "Auto-archive enabled"
				: "Auto-archive disabled"
		);
	};

	const handleArchiveNow = async () => {
		if (!settings) return;

		// No `finally`: the React Compiler can't yet optimize a component with a
		// try/finally, so the archiving reset is duplicated across both paths.
		setIsArchiving(true);
		try {
			const count = await archiveOldTasks(settings.archiveAfterDays);
			toast.success(`Archived ${count} task${count !== 1 ? 's' : ''}`);
			setIsArchiving(false);
		} catch (err) {
			const errorMsg =
				err instanceof Error ? err.message : "Failed to archive tasks";
			toast.error(errorMsg);
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
			<SettingsRow
				label="Auto-archive"
				description="Archive old completed tasks"
				state={settings.enabled}
			>
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
					type="button"
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
				type="button"
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
