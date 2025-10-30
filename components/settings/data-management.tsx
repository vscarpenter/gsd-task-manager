"use client";

import { DatabaseIcon, DownloadIcon, UploadIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface DataManagementProps {
	isExpanded: boolean;
	onToggle: () => void;
	activeTasks: number;
	completedTasks: number;
	totalTasks: number;
	estimatedSize: string;
	onExport: () => Promise<void>;
	onImportClick: () => void;
	isLoading?: boolean;
}

export function DataManagement({
	isExpanded,
	onToggle,
	activeTasks,
	completedTasks,
	totalTasks,
	estimatedSize,
	onExport,
	onImportClick,
	isLoading,
}: DataManagementProps) {
	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
				<div className="flex items-center gap-3">
					<DatabaseIcon className="h-5 w-5 text-accent" />
					<span className="font-semibold text-foreground">Data & Backup</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${
						isExpanded ? "rotate-90" : ""
					}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
				{/* Storage Stats */}
				<div className="rounded-lg border border-border bg-background-muted/50 p-4">
					<h4 className="text-sm font-semibold text-foreground mb-2">Storage</h4>
					<div className="space-y-1 text-xs text-foreground-muted">
						<p>
							Active tasks:{" "}
							<span className="font-medium text-foreground">{activeTasks}</span>
						</p>
						<p>
							Completed tasks:{" "}
							<span className="font-medium text-foreground">{completedTasks}</span>
						</p>
						<p>
							Total tasks:{" "}
							<span className="font-medium text-foreground">{totalTasks}</span>
						</p>
						<p>
							Estimated size:{" "}
							<span className="font-medium text-foreground">{estimatedSize} KB</span>
						</p>
					</div>
				</div>

				{/* Export/Import Actions */}
				<div className="space-y-2">
					<Button
						variant="subtle"
						className="w-full justify-start"
						onClick={onExport}
						disabled={isLoading}
					>
						<DownloadIcon className="mr-2 h-4 w-4" />
						Export Tasks
					</Button>
					<Button
						variant="subtle"
						className="w-full justify-start"
						onClick={onImportClick}
						disabled={isLoading}
					>
						<UploadIcon className="mr-2 h-4 w-4" />
						Import Tasks
					</Button>
					<p className="text-xs text-foreground-muted px-2">
						Export your tasks as JSON for backup or transfer. Import to restore or
						merge tasks.
					</p>
				</div>

				{/* Clear Data Warning */}
				<div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 p-3">
					<p className="text-xs text-red-600 dark:text-red-400 mb-2">
						⚠️ Clearing data is permanent and cannot be undone. Export your tasks
						first.
					</p>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
