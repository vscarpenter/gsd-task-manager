/* eslint-disable react/no-unescaped-entities */
"use client";

import { DatabaseIcon } from "lucide-react";
import { GuideSection } from "./shared-components";

interface DataPrivacySectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function DataPrivacySection({
	expanded,
	onToggle,
}: DataPrivacySectionProps) {
	return (
		<GuideSection
			icon={<DatabaseIcon className="h-5 w-5" />}
			title="Data & Privacy"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Local-First Architecture
					</h4>
					<p className="text-foreground-muted">
						All your data stays on YOUR device. GSD uses IndexedDB (browser
						storage) to save tasks, settings, and preferences. Nothing is sent
						to any server. No tracking, no analytics, no cloud sync. Your tasks
						are private by design.
					</p>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Backup Strategy
					</h4>
					<ul className="space-y-2 text-foreground-muted">
						<li>
							<strong>Weekly Exports:</strong> Settings → Export Tasks → Save
							JSON file
						</li>
						<li>
							<strong>Version Control:</strong> Name files with dates (e.g.,
							gsd-backup-2025-10-12.json)
						</li>
						<li>
							<strong>Cloud Backup:</strong> Store export files in
							Dropbox/iCloud/Drive
						</li>
						<li>
							<strong>Before Major Changes:</strong> Always export first!
						</li>
					</ul>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">Import Options</h4>
					<p className="text-foreground-muted mb-2">When importing, choose:</p>
					<ul className="space-y-1 text-foreground-muted list-disc list-inside">
						<li>
							<strong>Merge:</strong> Add imported tasks to existing ones (safe
							for combining)
						</li>
						<li>
							<strong>Replace:</strong> Delete everything and start fresh
							(destructive!)
						</li>
					</ul>
				</div>

				<div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3">
					<h5 className="font-semibold text-sm text-green-600 dark:text-green-400 mb-2">
						Privacy Guarantee
					</h5>
					<p className="text-green-600 dark:text-green-400">
						GSD Task Manager is open source and auditable. View the code on
						GitHub to verify: zero network requests, zero tracking, zero data
						collection. Your productivity is your business.
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
