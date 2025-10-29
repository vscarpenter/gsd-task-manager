/* eslint-disable react/no-unescaped-entities */
"use client";

import { FilterIcon } from "lucide-react";
import { GuideSection } from "./shared-components";

interface SmartViewsSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function SmartViewsSection({
	expanded,
	onToggle,
}: SmartViewsSectionProps) {
	return (
		<GuideSection
			icon={<FilterIcon className="h-5 w-5" />}
			title="Smart Views & Filtering"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Built-in Smart Views
					</h4>
					<ul className="space-y-2 text-foreground-muted">
						<li>
							<strong>Today's Focus:</strong> All tasks due today—your daily
							action list
						</li>
						<li>
							<strong>This Week:</strong> Everything due in the next 7 days
						</li>
						<li>
							<strong>Overdue Backlog:</strong> Past-due tasks requiring
							attention
						</li>
						<li>
							<strong>No Deadline:</strong> Tasks without due dates (good for Q2
							work)
						</li>
						<li>
							<strong>Recently Added:</strong> Tasks created in the last 7 days
						</li>
						<li>
							<strong>Recently Completed:</strong> Your wins from the past week
						</li>
						<li>
							<strong>Recurring Tasks:</strong> All repeating tasks
						</li>
					</ul>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Creating Custom Views
					</h4>
					<ol className="space-y-2 text-foreground-muted list-decimal list-inside">
						<li>Apply filters (quadrants, tags, status, dates)</li>
						<li>Click "Save as Smart View"</li>
						<li>
							Name it descriptively (e.g., "Monday Morning Priorities")
						</li>
						<li>Access it anytime from the Smart Views dropdown</li>
					</ol>
				</div>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<p className="text-foreground">
						<strong>Workflow Idea:</strong> Create a "Deep Work Thursday" view
						filtering for #deep-work tasks in Q2. Check this view every Thursday
						to protect your focus time!
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
