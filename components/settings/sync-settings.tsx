"use client";

import { CloudIcon, ChevronRightIcon, HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
				<div className="flex items-center gap-3">
					<CloudIcon className="h-5 w-5 text-accent" />
					<span className="font-semibold text-foreground">Cloud Sync</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${
						isExpanded ? "rotate-90" : ""
					}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
				{/* Sync History */}
				<div className="space-y-2">
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
