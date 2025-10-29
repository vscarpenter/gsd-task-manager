/* eslint-disable react/no-unescaped-entities */
"use client";

import { MousePointerClickIcon } from "lucide-react";
import { GuideSection } from "./shared-components";

interface BatchOperationsSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function BatchOperationsSection({
	expanded,
	onToggle,
}: BatchOperationsSectionProps) {
	return (
		<GuideSection
			icon={<MousePointerClickIcon className="h-5 w-5" />}
			title="Batch Operations"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<div>
					<h4 className="font-semibold text-foreground mb-2">Selection Mode</h4>
					<p className="text-foreground-muted mb-2">
						Click anywhere on a task card to select it. A ring appears around
						selected tasks. Selection mode activates automatically when you
						select the first task.
					</p>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">Batch Actions</h4>
					<ul className="space-y-2 text-foreground-muted">
						<li>
							<strong>Complete:</strong> Mark multiple tasks done at once
						</li>
						<li>
							<strong>Uncomplete:</strong> Reopen completed tasks
						</li>
						<li>
							<strong>Move to Quadrant:</strong> Bulk recategorization
						</li>
						<li>
							<strong>Add Tags:</strong> Tag multiple related tasks simultaneously
						</li>
						<li>
							<strong>Delete:</strong> Remove multiple tasks (use carefully!)
						</li>
					</ul>
				</div>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<p className="text-foreground">
						<strong>Use Case:</strong> End of week? Select all completed tasks,
						add #done-this-week tag, then review them for your weekly wins
						celebration!
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
