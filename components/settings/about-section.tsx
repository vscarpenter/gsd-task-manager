"use client";

import { InfoIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AboutSectionProps {
	isExpanded: boolean;
	onToggle: () => void;
}

export function AboutSection({ isExpanded, onToggle }: AboutSectionProps) {
	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
				<div className="flex items-center gap-3">
					<InfoIcon className="h-5 w-5 text-accent" />
					<span className="font-semibold text-foreground">About</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${
						isExpanded ? "rotate-90" : ""
					}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4 space-y-3">
				<div className="space-y-2 text-sm">
					<div className="flex justify-between">
						<span className="text-foreground-muted">Version</span>
						<span className="font-medium text-foreground">
							{process.env.NEXT_PUBLIC_BUILD_NUMBER || "5.3.0"}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-foreground-muted">Build Date</span>
						<span className="font-medium text-foreground">
							{process.env.NEXT_PUBLIC_BUILD_DATE || "dev build"}
						</span>
					</div>
				</div>

				<div className="rounded-lg border border-border bg-background-muted/50 p-3">
					<p className="text-xs text-foreground-muted mb-2">
						🔒{" "}
						<span className="font-semibold text-foreground">Privacy First</span>
					</p>
					<p className="text-xs text-foreground-muted">
						All your data is stored locally in your browser. Nothing is sent to any
						server. Your tasks, preferences, and settings stay on your device.
					</p>
				</div>

				<Button
					variant="subtle"
					className="w-full justify-start"
					onClick={() =>
						window.open("https://github.com/vscarpenter/gsd-task-manager", "_blank")
					}
				>
					View on GitHub →
				</Button>
			</CollapsibleContent>
		</Collapsible>
	);
}
