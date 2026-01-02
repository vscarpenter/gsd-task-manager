/* eslint-disable react/no-unescaped-entities */
"use client";

import { KeyboardIcon } from "lucide-react";
import { GuideSection, ShortcutRow } from "./shared-components";

interface ShortcutsSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function ShortcutsSection({
	expanded,
	onToggle,
}: ShortcutsSectionProps) {
	return (
		<GuideSection
			icon={<KeyboardIcon className="h-5 w-5" />}
			title="Keyboard Shortcuts & Power User Tips"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Global Shortcuts
					</h4>
					<div className="space-y-2">
						<ShortcutRow shortcut="⌘K / Ctrl+K" description="Open command palette (universal search & actions)" />
						<ShortcutRow shortcut="N" description="Create new task" />
						<ShortcutRow shortcut="/" description="Focus search bar" />
						<ShortcutRow shortcut="?" description="Open this user guide" />
						<ShortcutRow shortcut="Esc" description="Close dialogs" />
					</div>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Command Palette Shortcuts
					</h4>
					<div className="space-y-2">
						<ShortcutRow shortcut="⌘M / Ctrl+M" description="View matrix" />
						<ShortcutRow shortcut="⌘D / Ctrl+D" description="View dashboard" />
						<ShortcutRow shortcut="⌘T / Ctrl+T" description="Toggle theme" />
						<ShortcutRow shortcut="⌘N / Ctrl+N" description="Create new task" />
						<ShortcutRow shortcut="⌘, / Ctrl+," description="Open settings" />
					</div>
					<p className="text-xs text-foreground-muted mt-2">
						💡 Use ⌘K then type "archive" or "sync history" to navigate to those views.
					</p>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Smart View Shortcuts
					</h4>
					<div className="space-y-2">
						<ShortcutRow shortcut="1-9" description="Activate pinned smart view at position" />
						<ShortcutRow shortcut="0" description="Clear active smart view filter" />
					</div>
					<p className="text-xs text-foreground-muted mt-2">
						💡 Pin your favorite smart views using the "More" button (⋯) in the header, then use number keys for instant access!
					</p>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Power User Tips
					</h4>
					<ul className="space-y-2 text-foreground-muted">
						<li>💡 Use ⌘K command palette to discover all available actions</li>
						<li>💡 Pin your most-used smart views for instant number-key access</li>
						<li>💡 Use tags strategically—they're your custom categories</li>
						<li>💡 Review Dashboard weekly to spot trends</li>
						<li>💡 Set recurring tasks for weekly/monthly reviews</li>
						<li>
							💡 Use subtasks for complex projects (keeps main list clean)
						</li>
						<li>💡 Create Smart Views for morning/afternoon routines</li>
						<li>
							💡 Batch similar tasks together (e.g., all #phone-calls at once)
						</li>
						<li>💡 Use dependencies to sequence projects correctly</li>
						<li>
							💡 Use Quick Settings panel for theme/notifications without full settings
						</li>
					</ul>
				</div>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<p className="text-foreground">
						<strong>🎯 Pro Workflow:</strong> Press ⌘K to open the command palette, type a few letters of any task/action/view, and hit Enter. Navigate your entire workflow without touching the mouse!
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
