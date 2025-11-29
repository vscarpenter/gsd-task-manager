"use client";

import { useState } from "react";
import { DownloadIcon, UploadIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { ResetEverythingDialog } from "@/components/reset-everything-dialog";

interface DataManagementProps {
	activeTasks: number;
	completedTasks: number;
	totalTasks: number;
	estimatedSize: string;
	onExport: () => Promise<void>;
	onImportClick: () => void;
	isLoading?: boolean;
	syncEnabled?: boolean;
	pendingSync?: number;
}

/**
 * iOS-style data management settings
 */
export function DataManagement({
	activeTasks,
	completedTasks,
	totalTasks,
	estimatedSize,
	onExport,
	onImportClick,
	isLoading,
	syncEnabled = false,
	pendingSync = 0,
}: DataManagementProps) {
	const [resetDialogOpen, setResetDialogOpen] = useState(false);

	return (
		<>
			{/* Storage Stats Row */}
			<SettingsRow label="Local storage">
				<div className="text-right">
					<p className="text-sm font-medium text-foreground">{estimatedSize} KB</p>
					<p className="text-xs text-foreground-muted">{totalTasks} tasks</p>
				</div>
			</SettingsRow>

			{/* Task Breakdown Row */}
			<SettingsRow label="Tasks breakdown">
				<div className="flex gap-4 text-xs">
					<span className="text-foreground-muted">
						Active: <span className="font-medium text-foreground">{activeTasks}</span>
					</span>
					<span className="text-foreground-muted">
						Done: <span className="font-medium text-foreground">{completedTasks}</span>
					</span>
				</div>
			</SettingsRow>

			{/* Export Row */}
			<ActionRow
				icon={DownloadIcon}
				label="Export tasks"
				description="Download as JSON backup"
				onClick={onExport}
				disabled={isLoading}
			/>

			{/* Import Row */}
			<ActionRow
				icon={UploadIcon}
				label="Import tasks"
				description="Restore from JSON file"
				onClick={onImportClick}
				disabled={isLoading}
			/>

			{/* Danger Zone - Reset */}
			<ActionRow
				icon={Trash2Icon}
				label="Reset everything"
				description="Delete all local data"
				onClick={() => setResetDialogOpen(true)}
				disabled={isLoading}
				variant="danger"
			/>

			{/* Reset Dialog */}
			<ResetEverythingDialog
				open={resetDialogOpen}
				onOpenChange={setResetDialogOpen}
				onExport={onExport}
				activeTasks={activeTasks}
				completedTasks={completedTasks}
				syncEnabled={syncEnabled}
				pendingSync={pendingSync}
			/>
		</>
	);
}

/**
 * Settings row with inline content
 */
function SettingsRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]">
			<p className="text-sm font-medium text-foreground">{label}</p>
			<div className="flex-shrink-0">{children}</div>
		</div>
	);
}

/**
 * Actionable row with icon and disclosure indicator
 */
function ActionRow({
	icon: Icon,
	label,
	description,
	onClick,
	disabled,
	variant = "default",
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	description?: string;
	onClick: () => void;
	disabled?: boolean;
	variant?: "default" | "danger";
}) {
	const isDanger = variant === "danger";

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`
				w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px] text-left
				transition-colors disabled:opacity-50
				${isDanger
					? "hover:bg-red-50 dark:hover:bg-red-950/20"
					: "hover:bg-background-muted/50"
				}
			`}
		>
			<Icon className={`w-5 h-5 ${isDanger ? "text-red-500" : "text-accent"}`} />
			<div className="flex-1 min-w-0">
				<p className={`text-sm font-medium ${isDanger ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
					{label}
				</p>
				{description && (
					<p className="text-xs text-foreground-muted mt-0.5">{description}</p>
				)}
			</div>
			<ChevronRightIcon className="w-4 h-4 text-foreground-muted/50 flex-shrink-0" />
		</button>
	);
}
