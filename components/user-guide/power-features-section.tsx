/* eslint-disable react/no-unescaped-entities */
"use client";

import { ZapIcon, KeyboardIcon, SettingsIcon, CommandIcon } from "lucide-react";
import { GuideSection, AdvancedFeature } from "./shared-components";

interface PowerFeaturesSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function PowerFeaturesSection({
	expanded,
	onToggle,
}: PowerFeaturesSectionProps) {
	return (
		<GuideSection
			icon={<ZapIcon className="h-5 w-5" />}
			title="Power Features (v5.10.0)"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				{/* Command Palette */}
				<AdvancedFeature
					icon={<CommandIcon className="h-4 w-4" />}
					title="Command Palette"
					description="Universal search and action interface"
				>
					<div className="space-y-3">
						<p className="text-foreground-muted">
							Press <kbd className="px-2 py-1 bg-accent/10 border border-accent/20 rounded text-xs font-mono">⌘K</kbd> (Mac)
							or <kbd className="px-2 py-1 bg-accent/10 border border-accent/20 rounded text-xs font-mono">Ctrl+K</kbd> (Windows/Linux)
							to open the command palette—your gateway to everything in GSD.
						</p>

						<div>
							<h5 className="font-semibold text-foreground mb-2">What can you do?</h5>
							<ul className="space-y-1.5 text-foreground-muted">
								<li>🔍 <strong>Search tasks</strong> — Find any task by title, description, tags, or subtasks</li>
								<li>⚡ <strong>Quick actions</strong> — Create tasks, export/import, trigger sync, toggle theme</li>
								<li>🧭 <strong>Navigate</strong> — Jump to matrix, dashboard, archive, or sync history</li>
								<li>👁️ <strong>Apply smart views</strong> — Filter tasks with built-in views (Today's Focus, This Week, etc.)</li>
								<li>⚙️ <strong>Open settings</strong> — Access settings or user guide instantly</li>
							</ul>
						</div>

						<div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
							<p className="text-sm text-blue-900 dark:text-blue-100">
								<strong>💡 Pro tip:</strong> The command palette shows keyboard shortcuts next to actions.
								Discover new shortcuts by browsing the palette!
							</p>
						</div>

						<div>
							<h5 className="font-semibold text-foreground mb-2">How to use it:</h5>
							<ol className="space-y-1.5 text-foreground-muted list-decimal list-inside">
								<li>Press ⌘K to open</li>
								<li>Type to search (actions, tasks, views, settings)</li>
								<li>Use arrow keys to navigate</li>
								<li>Press Enter to execute/select</li>
								<li>Press Escape to close</li>
							</ol>
						</div>
					</div>
				</AdvancedFeature>

				{/* Quick Settings Panel */}
				<AdvancedFeature
					icon={<SettingsIcon className="h-4 w-4" />}
					title="Quick Settings Panel"
					description="Frequently-adjusted preferences in a slide-out panel"
				>
					<div className="space-y-3">
						<p className="text-foreground-muted">
							Click the settings icon (gear) in the header to access your most frequently-adjusted
							settings without opening the full settings dialog.
						</p>

						<div>
							<h5 className="font-semibold text-foreground mb-2">Available settings:</h5>
							<ul className="space-y-1.5 text-foreground-muted">
								<li>🎨 <strong>Theme</strong> — Switch between light, dark, or system auto-theme</li>
								<li>✅ <strong>Show completed</strong> — Toggle visibility of completed tasks</li>
								<li>🔔 <strong>Notifications</strong> — Enable/disable due date reminders</li>
								<li>☁️ <strong>Auto-sync interval</strong> — Adjust how often tasks sync (1-30 minutes)</li>
							</ul>
						</div>

						<div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
							<p className="text-sm text-green-900 dark:text-green-100">
								<strong>💡 Quick tip:</strong> Use the Quick Settings panel to temporarily hide completed
								tasks during focus sessions, then show them later for review.
							</p>
						</div>
					</div>
				</AdvancedFeature>

				{/* Smart View Pinning */}
				<AdvancedFeature
					icon={<KeyboardIcon className="h-4 w-4" />}
					title="Smart View Pinning"
					description="Pin up to 5 smart views for instant keyboard access"
				>
					<div className="space-y-3">
						<p className="text-foreground-muted">
							Pin your most-used smart views to the header and access them with number keys (1-9).
						</p>

						<div>
							<h5 className="font-semibold text-foreground mb-2">How to pin views:</h5>
							<ol className="space-y-1.5 text-foreground-muted list-decimal list-inside">
								<li>Click the "More" button (⋯) in the header</li>
								<li>Click the pin icon next to any smart view</li>
								<li>Pinned views appear as pills in the header</li>
								<li>Press number keys (1-9) to activate instantly</li>
								<li>Press 0 to clear the active view</li>
							</ol>
						</div>

						<div className="rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 p-3">
							<p className="text-sm text-purple-900 dark:text-purple-100">
								<strong>🎯 Example workflow:</strong> Pin "Today's Focus" (1), "This Week" (2),
								and "Overdue Backlog" (3). Start your day with 1, plan ahead with 2,
								and catch up with 3—all without touching the mouse!
							</p>
						</div>
					</div>
				</AdvancedFeature>

				{/* Combined Power User Workflow */}
				<div className="rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2 border-blue-200 dark:border-blue-800 p-4">
					<h5 className="font-semibold text-foreground mb-3 flex items-center gap-2">
						<ZapIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
						🚀 Power User Workflow Example
					</h5>
					<div className="space-y-2 text-sm text-foreground-muted">
						<p><strong>Morning routine:</strong></p>
						<ol className="list-decimal list-inside space-y-1 ml-2">
							<li>Press <kbd className="px-1.5 py-0.5 bg-white/50 dark:bg-black/30 border border-accent/20 rounded text-xs font-mono">1</kbd> → View "Today's Focus"</li>
							<li>Press <kbd className="px-1.5 py-0.5 bg-white/50 dark:bg-black/30 border border-accent/20 rounded text-xs font-mono">n</kbd> → Create new task for today</li>
							<li>Press <kbd className="px-1.5 py-0.5 bg-white/50 dark:bg-black/30 border border-accent/20 rounded text-xs font-mono">⌘K</kbd> → Type "dashboard" → Review yesterday's work</li>
							<li>Press <kbd className="px-1.5 py-0.5 bg-white/50 dark:bg-black/30 border border-accent/20 rounded text-xs font-mono">⌘T</kbd> → Switch to light theme for daytime work</li>
							<li>Click settings icon → Toggle "Show completed" off for focus mode</li>
						</ol>
						<p className="pt-2">
							<strong>All in under 30 seconds, mostly keyboard-driven!</strong> 🎯
						</p>
					</div>
				</div>
			</div>
		</GuideSection>
	);
}
