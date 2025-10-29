/* eslint-disable react/no-unescaped-entities */
"use client";

import {
	ZapIcon,
	RepeatIcon,
	TagIcon,
	CheckSquareIcon,
	LinkIcon,
	CalendarIcon,
} from "lucide-react";
import { GuideSection, AdvancedFeature } from "./shared-components";

interface AdvancedFeaturesSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function AdvancedFeaturesSection({
	expanded,
	onToggle,
}: AdvancedFeaturesSectionProps) {
	return (
		<GuideSection
			icon={<ZapIcon className="h-5 w-5" />}
			title="Advanced Features"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4">
				<AdvancedFeature
					icon={<RepeatIcon className="h-4 w-4" />}
					title="Recurring Tasks"
					description="Perfect for habits, routines, and regular reviews."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>
							<strong>Daily:</strong> Exercise, journaling, standup meetings
						</li>
						<li>
							<strong>Weekly:</strong> Review tasks, team 1-on-1s, planning
						</li>
						<li>
							<strong>Monthly:</strong> Budget review, goal check-ins, reports
						</li>
						<li>
							When completed, a new task is auto-created with the next due date
						</li>
						<li>Subtasks reset in new instances</li>
					</ul>
				</AdvancedFeature>

				<AdvancedFeature
					icon={<TagIcon className="h-4 w-4" />}
					title="Tags & Labels"
					description="Organize tasks across quadrants by project, context, or energy level."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>
							<strong>Projects:</strong> #website-redesign, #q4-launch
						</li>
						<li>
							<strong>Contexts:</strong> #at-office, #at-home, #phone-calls
						</li>
						<li>
							<strong>Energy:</strong> #deep-work, #quick-wins, #low-energy
						</li>
						<li>Multiple tags per task</li>
						<li>Use tag analytics to see where time goes</li>
					</ul>
				</AdvancedFeature>

				<AdvancedFeature
					icon={<CheckSquareIcon className="h-4 w-4" />}
					title="Subtasks & Checklists"
					description="Break complex work into bite-sized, achievable steps."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>Turn big tasks into actionable checklists</li>
						<li>See progress bars (e.g., 3/5 complete)</li>
						<li>Great for projects with multiple steps</li>
						<li>
							Example: "Launch product" → Research, Design, Build, Test, Deploy
						</li>
					</ul>
				</AdvancedFeature>

				<AdvancedFeature
					icon={<LinkIcon className="h-4 w-4" />}
					title="Task Dependencies"
					description="Define relationships: Task B can't start until Task A is done."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>Create workflows with blocking relationships</li>
						<li>Prevents starting tasks too early</li>
						<li>Circular dependency protection</li>
						<li>
							Example: Can't "Deploy to production" until "QA testing" is
							complete
						</li>
					</ul>
				</AdvancedFeature>

				<AdvancedFeature
					icon={<CalendarIcon className="h-4 w-4" />}
					title="Due Dates & Notifications"
					description="Never miss a deadline with smart reminders."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>Visual indicators: Red for overdue, amber for due today</li>
						<li>Browser notifications (if enabled)</li>
						<li>Customize reminder time (15min to 1 day before)</li>
						<li>Snooze notifications if needed</li>
						<li>Badge API shows count on PWA icon</li>
					</ul>
				</AdvancedFeature>
			</div>
		</GuideSection>
	);
}
