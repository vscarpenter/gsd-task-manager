"use client";

import { ChevronRightIcon, ExternalLinkIcon, ShieldCheckIcon } from "lucide-react";
import { SettingsRow } from "./shared-components";
import { REPLAY_ONBOARDING_EVENT } from "@/components/onboarding/onboarding-gate";

/**
 * iOS-style about section
 */
export function AboutSection() {
	const version = process.env.NEXT_PUBLIC_BUILD_NUMBER || "6.1.1";
	const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || "dev build";

	return (
		<>
			{/* Version Row */}
			<SettingsRow label="Version">
				<span className="text-sm text-foreground-muted">{version}</span>
			</SettingsRow>

			{/* Build Date Row */}
			<SettingsRow label="Build">
				<span className="text-sm text-foreground-muted">{buildDate}</span>
			</SettingsRow>

			{/* Privacy Row */}
			<div className="px-4 py-3.5 min-h-[52px]">
				<div className="flex items-start gap-3">
					<ShieldCheckIcon className="w-5 h-5 text-olive flex-shrink-0 mt-0.5" />
					<div>
						<p className="text-sm font-medium text-foreground">Privacy First</p>
						<p className="text-xs text-foreground-muted mt-1 leading-relaxed">
							All data is stored locally in your browser. Nothing is sent to any
							server unless you enable cloud sync.
						</p>
					</div>
				</div>
			</div>

			{/* Replay the welcome tour (reference §09: re-showable from Settings → About) */}
			<button
				type="button"
				onClick={() => window.dispatchEvent(new Event(REPLAY_ONBOARDING_EVENT))}
				className="w-full flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]
				           text-left hover:bg-background-muted/50 transition-colors"
			>
				<span className="text-sm font-medium text-foreground">Replay welcome tour</span>
				<ChevronRightIcon className="w-4 h-4 text-foreground-muted/50" />
			</button>

			{/* Privacy Policy Link Row */}
			<a
				href="https://gsdtaskmanager.com/privacy/"
				target="_blank"
				rel="noopener noreferrer"
				className="w-full flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]
				           text-left hover:bg-background-muted/50 transition-colors"
			>
				<span className="text-sm font-medium text-accent">Privacy Policy</span>
				<ExternalLinkIcon className="w-4 h-4 text-foreground-muted/50" />
			</a>

			{/* GitHub Link Row */}
			<a
				href="https://github.com/vscarpenter/gsd-task-manager"
				target="_blank"
				rel="noopener noreferrer"
				className="w-full flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]
				           text-left hover:bg-background-muted/50 transition-colors"
			>
				<span className="text-sm font-medium text-accent">View on GitHub</span>
				<ExternalLinkIcon className="w-4 h-4 text-foreground-muted/50" />
			</a>

			{/* Codebase Analysis Report Link Row */}
			<a
				href="/docs/codebase-analysis-report.html"
				target="_blank"
				rel="noopener noreferrer"
				className="w-full flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]
				           text-left hover:bg-background-muted/50 transition-colors"
			>
				<span className="text-sm font-medium text-accent">Codebase Analysis Report</span>
				<ExternalLinkIcon className="w-4 h-4 text-foreground-muted/50" />
			</a>
		</>
	);
}
