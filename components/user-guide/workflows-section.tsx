"use client";

import { TrendingUpIcon } from "lucide-react";
import { GuideSection, WorkflowBlock } from "./shared-components";

interface WorkflowsSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function WorkflowsSection({
	expanded,
	onToggle,
}: WorkflowsSectionProps) {
	return (
		<GuideSection
			icon={<TrendingUpIcon className="h-5 w-5" />}
			title="Workflows & Best Practices"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<WorkflowBlock
					title="Daily Review (Morning, 10 minutes)"
					steps={[
						"Check 'Today's Focus' Smart View",
						"Review Q1 (Do First)—what's urgent today?",
						"Pick 1-2 Q2 tasks to protect time for",
						"Set intentions: What would make today a success?",
					]}
				/>

				<WorkflowBlock
					title="Weekly Planning (Friday or Sunday, 30 minutes)"
					steps={[
						"Review completed tasks—celebrate wins!",
						"Check 'Overdue Backlog'—reschedule or delete",
						"Review Q2—what moves you toward big goals?",
						"Plan next week's Q2 blocks (calendar time)",
						"Export backup (Settings → Export Tasks)",
					]}
				/>

				<WorkflowBlock
					title="Monthly Review (Last Sunday, 1 hour)"
					steps={[
						"Check Dashboard—what patterns emerged?",
						"Review quadrant distribution—are you in Q2 enough?",
						"Update recurring tasks if routines changed",
						"Reflect: What worked? What didn't?",
						"Set intention for next month",
					]}
				/>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<h5 className="font-semibold text-foreground mb-2">GTD Integration</h5>
					<p className="text-foreground-muted">
						Use GSD alongside Getting Things Done (GTD):
					</p>
					<ul className="list-disc list-inside text-foreground-muted mt-2 space-y-1">
						<li>Inbox → New tasks in GSD</li>
						<li>Next Actions → Q1 and Q2 tasks</li>
						<li>Projects → Tags like #project-name</li>
						<li>Waiting For → Create task with dependency</li>
						<li>Someday/Maybe → Q4 or no due date Q2 tasks</li>
					</ul>
				</div>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<h5 className="font-semibold text-foreground mb-2">
						Time Blocking Strategy
					</h5>
					<p className="text-foreground-muted mb-2">
						Schedule your quadrants throughout the day:
					</p>
					<ul className="list-disc list-inside text-foreground-muted space-y-1">
						<li>
							<strong>8-10am:</strong> Q2 Deep Work (most creative energy)
						</li>
						<li>
							<strong>10-12pm:</strong> Q1 Urgent tasks & meetings
						</li>
						<li>
							<strong>12-1pm:</strong> Lunch & Q4 catch-up
						</li>
						<li>
							<strong>1-3pm:</strong> Q3 Delegate & communicate
						</li>
						<li>
							<strong>3-5pm:</strong> Q2 or Q1 depending on urgency
						</li>
					</ul>
				</div>
			</div>
		</GuideSection>
	);
}
