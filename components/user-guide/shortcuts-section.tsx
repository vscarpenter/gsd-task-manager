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
						Essential Shortcuts
					</h4>
					<div className="space-y-2">
						<ShortcutRow shortcut="N" description="Create new task" />
						<ShortcutRow shortcut="/" description="Focus search bar" />
						<ShortcutRow shortcut="?" description="Open this user guide" />
						<ShortcutRow shortcut="Esc" description="Close dialogs" />
					</div>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Power User Tips
					</h4>
					<ul className="space-y-2 text-foreground-muted">
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
							💡 Hide completed tasks during work, show them for review
						</li>
					</ul>
				</div>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<p className="text-foreground">
						<strong>Hidden Gem:</strong> Click Matrix/Dashboard toggle to
						quickly switch views. Use Matrix for planning, Dashboard for
						reflection on what you accomplished!
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
