/* eslint-disable react/no-unescaped-entities */
"use client";

import { DatabaseIcon, CloudIcon, ShieldCheckIcon, LockIcon } from "lucide-react";
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
						Your data is stored locally on YOUR device using IndexedDB (browser
						storage). GSD works completely offline with no network required.
						Cloud sync is optional and fully encrypted.
					</p>
				</div>

				{/* Cloud Sync Section */}
				<div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
					<h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
						<CloudIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
						Optional Cloud Sync (v5.0.0)
					</h4>
					<div className="space-y-3 text-foreground-muted">
						<p>
							Enable cloud sync to access your tasks across multiple devices
							(phone, tablet, computer). Completely optional.
						</p>

						<div>
							<h5 className="font-medium text-foreground flex items-center gap-1.5 mb-1">
								<ShieldCheckIcon className="h-3 w-3 text-green-600" />
								Zero-Knowledge Architecture
							</h5>
							<ul className="space-y-1 list-disc list-inside ml-1">
								<li>End-to-end AES-256 encryption (military-grade)</li>
								<li>Your passphrase never leaves your device</li>
								<li>Server stores only encrypted blobs — we cannot read your tasks</li>
								<li>PBKDF2 key derivation with 600k iterations</li>
							</ul>
						</div>

						<div>
							<h5 className="font-medium text-foreground flex items-center gap-1.5 mb-1">
								<LockIcon className="h-3 w-3 text-blue-600" />
								Authentication Options
							</h5>
							<ul className="space-y-1 list-disc list-inside ml-1">
								<li>Sign in with Google or Apple</li>
								<li>Create an encryption passphrase (required for sync)</li>
								<li>Use the same passphrase on all devices to decrypt</li>
							</ul>
						</div>

						<div className="pt-2 border-t border-blue-200 dark:border-blue-800">
							<p className="text-xs">
								<strong>Settings → Sync</strong> to enable. View sync history
								in <strong>Settings → Sync → Sync History</strong>.
							</p>
						</div>
					</div>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Backup Strategy
					</h4>
					<ul className="space-y-2 text-foreground-muted">
						<li>
							<strong>Weekly Exports:</strong> Settings → Data → Export Tasks →
							Save JSON file
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

				{/* AI Integration Section */}
				<div>
					<h4 className="font-semibold text-foreground mb-2">
						AI Integration (Advanced)
					</h4>
					<p className="text-foreground-muted mb-2">
						GSD includes an optional MCP server for Claude Desktop integration,
						letting you query your tasks using natural language.
					</p>
					<ul className="space-y-1 text-foreground-muted list-disc list-inside">
						<li>"What are my urgent tasks this week?"</li>
						<li>"Find tasks related to the Q4 launch"</li>
						<li>"How many tasks do I have in each quadrant?"</li>
					</ul>
					<p className="text-xs text-foreground-muted mt-2">
						<strong>Security:</strong> Your encryption passphrase stays local.
						Claude can only read tasks — never modify or delete.
						See the GitHub README for setup instructions.
					</p>
				</div>

				<div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3">
					<h5 className="font-semibold text-sm text-green-600 dark:text-green-400 mb-2">
						Privacy Guarantee
					</h5>
					<p className="text-green-600 dark:text-green-400">
						GSD Task Manager is open source and auditable. Even with cloud sync
						enabled, your data is encrypted with your personal passphrase before
						leaving your device. Zero tracking, zero analytics.
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
