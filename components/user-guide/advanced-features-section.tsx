/* eslint-disable react/no-unescaped-entities */
"use client";

import {
	ZapIcon,
	RepeatIcon,
	TagIcon,
	CheckSquareIcon,
	LinkIcon,
	CalendarIcon,
	TimerIcon,
	BellOffIcon,
	ArchiveIcon,
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
				{/* Time Tracking - New in v6.4.0 */}
				<AdvancedFeature
					icon={<TimerIcon className="h-4 w-4" />}
					title="Time Tracking"
					description="Track how long you actually spend on tasks."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>
							<strong>Start/Stop Timer:</strong> Click the play button on any
							task card
						</li>
						<li>
							<strong>Time Estimates:</strong> Set expected duration when
							creating tasks
						</li>
						<li>
							<strong>Live Counter:</strong> See elapsed time update in
							real-time
						</li>
						<li>
							<strong>Analytics:</strong> View time spent per quadrant in
							Dashboard
						</li>
						<li>
							<strong>Estimation Accuracy:</strong> Compare estimates vs actual
							time
						</li>
					</ul>
					<div className="mt-2 rounded bg-green-50 dark:bg-green-950/30 p-2 text-xs text-green-700 dark:text-green-300">
						💡 Tip: Track time to understand where your hours really go!
					</div>
				</AdvancedFeature>

				{/* Snooze Notifications - New */}
				<AdvancedFeature
					icon={<BellOffIcon className="h-4 w-4" />}
					title="Snooze Notifications"
					description="Temporarily silence reminders when you need focus time."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>Click the bell icon on any task to snooze</li>
						<li>
							<strong>Options:</strong> 15 min, 30 min, 1 hour, 3 hours,
							tomorrow, next week
						</li>
						<li>Visual indicator shows remaining snooze time</li>
						<li>Clear snooze anytime to resume notifications</li>
					</ul>
				</AdvancedFeature>

				{/* Task Archive - New in v6.x */}
				<AdvancedFeature
					icon={<ArchiveIcon className="h-4 w-4" />}
					title="Task Archive"
					description="Keep your task list clean while preserving history."
				>
					<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
						<li>
							<strong>Auto-archive:</strong> Completed tasks archived after
							30/60/90 days
						</li>
						<li>
							<strong>Manual archive:</strong> Archive tasks immediately via
							Settings
						</li>
						<li>
							<strong>View archive:</strong> See all archived tasks in dedicated
							view
						</li>
						<li>
							<strong>Restore:</strong> Bring archived tasks back to active list
						</li>
						<li>
							<strong>Permanent delete:</strong> Remove archived tasks forever
						</li>
					</ul>
					<div className="mt-2 text-xs text-foreground-muted">
						Access via <strong>Settings → Archive</strong> or{" "}
						<strong>⌘K → "archive"</strong>
					</div>
				</AdvancedFeature>

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
						<li>Snooze notifications if you need focus time</li>
						<li>Badge API shows count on PWA icon</li>
					</ul>
				</AdvancedFeature>
			</div>
		</GuideSection>
	);
}
