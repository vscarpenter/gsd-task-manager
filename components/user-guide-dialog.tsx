/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState } from "react";
import {
	BookOpenIcon,
	RocketIcon,
	GridIcon,
	ListIcon,
	RepeatIcon,
	TagIcon,
	CheckSquareIcon,
	LinkIcon,
	CalendarIcon,
	FilterIcon,
	MousePointerClickIcon,
	BarChart3Icon,
	TrendingUpIcon,
	DatabaseIcon,
	KeyboardIcon,
	SmartphoneIcon,
	LightbulbIcon,
	ZapIcon,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRightIcon } from "lucide-react";

interface UserGuideDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function UserGuideDialog({ open, onOpenChange }: UserGuideDialogProps) {
	const [expandedSections, setExpandedSections] = useState({
		gettingStarted: true,
		matrix: false,
		taskManagement: false,
		advancedFeatures: false,
		smartViews: false,
		batchOps: false,
		dashboard: false,
		workflows: false,
		dataPrivacy: false,
		shortcuts: false,
		pwa: false,
	});

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-2xl">
						<BookOpenIcon className="h-6 w-6 text-accent" />
						GSD Task Manager - User Guide
					</DialogTitle>
					<DialogDescription>
						Master productivity with the Eisenhower Matrix and GSD's powerful
						features
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					{/* Getting Started */}
					<GuideSection
						icon={<RocketIcon className="h-5 w-5" />}
						title="Getting Started"
						expanded={expandedSections.gettingStarted}
						onToggle={() => toggleSection("gettingStarted")}
					>
						<div className="space-y-4">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Welcome to GSD Task Manager!
								</h4>
								<p className="text-sm text-foreground-muted">
									GSD (Get Stuff Done) helps you prioritize what matters using
									the Eisenhower Matrix. This guide will help you master
									productivity and achieve your goals.
								</p>
							</div>

							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Creating Your First Task
								</h4>
								<ol className="text-sm text-foreground-muted space-y-2 list-decimal list-inside">
									<li>
										Click the <strong>New Task</strong> button (or press{" "}
										<kbd className="px-2 py-1 bg-background-muted rounded text-xs">
											N
										</kbd>
										)
									</li>
									<li>
										Enter a clear, actionable title (e.g., "Review Q4 budget
										proposal")
									</li>
									<li>Add details in the description field</li>
									<li>
										Categorize: Is it <strong>Urgent</strong>? Is it{" "}
										<strong>Important</strong>?
									</li>
									<li>
										Optionally set a due date, add tags, or create subtasks
									</li>
									<li>
										Click <strong>Add Task</strong>
									</li>
								</ol>
							</div>

							<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
								<p className="text-sm text-foreground">
									<strong>Pro Tip:</strong> Start with 5-10 tasks to get
									familiar with the matrix. Don't worry about perfect
									categorization—you can always move tasks later!
								</p>
							</div>
						</div>
					</GuideSection>

					{/* Eisenhower Matrix */}
					<GuideSection
						icon={<GridIcon className="h-5 w-5" />}
						title="The Eisenhower Matrix Deep Dive"
						expanded={expandedSections.matrix}
						onToggle={() => toggleSection("matrix")}
					>
						<div className="space-y-4">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									The Philosophy
								</h4>
								<p className="text-sm text-foreground-muted">
									President Eisenhower said:{" "}
									<em>
										"What is important is seldom urgent, and what is urgent is
										seldom important."
									</em>
									This matrix helps you distinguish between the two and act
									accordingly.
								</p>
							</div>

							<div className="space-y-3">
								<QuadrantGuide
									title="Q1: Do First (Urgent + Important)"
									color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
									description="Crises, deadlines, emergencies—tasks that must be done NOW."
									examples={[
										"Client presentation due today",
										"System outage affecting customers",
										"Medical emergency",
										"Tax deadline tomorrow",
									]}
									strategy="Minimize Q1 by planning ahead. These tasks cause stress—aim to prevent them by working more in Q2."
									timeAllocation="15-20%"
								/>

								<QuadrantGuide
									title="Q2: Schedule (Not Urgent + Important)"
									color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
									description="Strategic work, planning, growth—this is where success lives."
									examples={[
										"Long-term project planning",
										"Learning new skills",
										"Building relationships",
										"Exercise and health",
										"Strategic thinking",
									]}
									strategy="THIS IS YOUR GOAL QUADRANT. Spend 60-70% of your time here. Schedule blocks for Q2 work before Q1 fires break out."
									timeAllocation="60-70% (GOAL)"
								/>

								<QuadrantGuide
									title="Q3: Delegate (Urgent + Not Important)"
									color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
									description="Interruptions and busywork that feel urgent but don't align with your goals."
									examples={[
										"Some meetings (ask: do I need to be there?)",
										"Other people's priorities",
										"Routine admin tasks",
										"Some emails and calls",
									]}
									strategy="Delegate, automate, or decline. These tasks steal time from Q2. Learn to say no politely."
									timeAllocation="15-20%"
								/>

								<QuadrantGuide
									title="Q4: Eliminate (Not Urgent + Not Important)"
									color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
									description="Time-wasters, distractions, and trivial tasks."
									examples={[
										"Mindless social media scrolling",
										"Excessive TV/streaming",
										"Busy work with no impact",
										"Unnecessary meetings",
									]}
									strategy="Ruthlessly eliminate these. They provide neither growth nor urgency. Use 'No' as a complete sentence."
									timeAllocation="0-5%"
								/>
							</div>

							<div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
								<h5 className="font-semibold text-sm text-red-600 dark:text-red-400 mb-2">
									Common Mistake: Living in Q1
								</h5>
								<p className="text-sm text-red-600 dark:text-red-400">
									Many people spend 80% of time in Q1, firefighting constantly.
									This leads to burnout. The solution? Schedule Q2 time daily
									(even 30 minutes) to prevent future Q1 crises.
								</p>
							</div>
						</div>
					</GuideSection>

					{/* Core Task Management */}
					<GuideSection
						icon={<ListIcon className="h-5 w-5" />}
						title="Core Task Management"
						expanded={expandedSections.taskManagement}
						onToggle={() => toggleSection("taskManagement")}
					>
						<div className="space-y-4 text-sm">
							<FeatureBlock
								title="Creating Tasks"
								items={[
									"Click the + button or press N key",
									"Title should be action-oriented (start with a verb)",
									"Use description for context, not just details",
									"Set due dates for time-sensitive work",
								]}
							/>

							<FeatureBlock
								title="Editing & Moving"
								items={[
									"Click any task to edit its details",
									"Drag tasks between quadrants",
									"Change urgency/importance toggles to recategorize",
									"Update as priorities shift—flexibility is key!",
								]}
							/>

							<FeatureBlock
								title="Completing Tasks"
								items={[
									"Click the checkmark to mark complete",
									"Completed tasks are hidden by default (toggle with eye icon)",
									"Recurring tasks automatically create new instances",
									"Review completed tasks weekly for insights",
								]}
							/>

							<FeatureBlock
								title="Search & Focus"
								items={[
									"Press / to focus search bar",
									"Search by title, description, tags, or subtasks",
									"Use Smart Views to filter by common criteria",
									"Combine filters for laser focus",
								]}
							/>
						</div>
					</GuideSection>

					{/* Advanced Features */}
					<GuideSection
						icon={<ZapIcon className="h-5 w-5" />}
						title="Advanced Features"
						expanded={expandedSections.advancedFeatures}
						onToggle={() => toggleSection("advancedFeatures")}
					>
						<div className="space-y-4">
							<AdvancedFeature
								icon={<RepeatIcon className="h-4 w-4" />}
								title="Recurring Tasks"
								description="Perfect for habits, routines, and regular reviews."
							>
								<ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
									<li>
										<strong>Daily:</strong> Exercise, journaling, standup
										meetings
									</li>
									<li>
										<strong>Weekly:</strong> Review tasks, team 1-on-1s,
										planning
									</li>
									<li>
										<strong>Monthly:</strong> Budget review, goal check-ins,
										reports
									</li>
									<li>
										When completed, a new task is auto-created with the next due
										date
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
										<strong>Contexts:</strong> #at-office, #at-home,
										#phone-calls
									</li>
									<li>
										<strong>Energy:</strong> #deep-work, #quick-wins,
										#low-energy
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
										Example: "Launch product" → Research, Design, Build, Test,
										Deploy
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
									<li>
										Visual indicators: Red for overdue, amber for due today
									</li>
									<li>Browser notifications (if enabled)</li>
									<li>Customize reminder time (15min to 1 day before)</li>
									<li>Snooze notifications if needed</li>
									<li>Badge API shows count on PWA icon</li>
								</ul>
							</AdvancedFeature>
						</div>
					</GuideSection>

					{/* Smart Views & Filtering */}
					<GuideSection
						icon={<FilterIcon className="h-5 w-5" />}
						title="Smart Views & Filtering"
						expanded={expandedSections.smartViews}
						onToggle={() => toggleSection("smartViews")}
					>
						<div className="space-y-4 text-sm">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Built-in Smart Views
								</h4>
								<ul className="space-y-2 text-foreground-muted">
									<li>
										<strong>Today's Focus:</strong> All tasks due today—your
										daily action list
									</li>
									<li>
										<strong>This Week:</strong> Everything due in the next 7
										days
									</li>
									<li>
										<strong>Overdue Backlog:</strong> Past-due tasks requiring
										attention
									</li>
									<li>
										<strong>No Deadline:</strong> Tasks without due dates (good
										for Q2 work)
									</li>
									<li>
										<strong>Recently Added:</strong> Tasks created in the last 7
										days
									</li>
									<li>
										<strong>Recently Completed:</strong> Your wins from the past
										week
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
									<strong>Workflow Idea:</strong> Create a "Deep Work Thursday"
									view filtering for #deep-work tasks in Q2. Check this view
									every Thursday to protect your focus time!
								</p>
							</div>
						</div>
					</GuideSection>

					{/* Batch Operations */}
					<GuideSection
						icon={<MousePointerClickIcon className="h-5 w-5" />}
						title="Batch Operations"
						expanded={expandedSections.batchOps}
						onToggle={() => toggleSection("batchOps")}
					>
						<div className="space-y-4 text-sm">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Selection Mode
								</h4>
								<p className="text-foreground-muted mb-2">
									Click anywhere on a task card to select it. A ring appears
									around selected tasks. Selection mode activates automatically
									when you select the first task.
								</p>
							</div>

							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Batch Actions
								</h4>
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
										<strong>Add Tags:</strong> Tag multiple related tasks
										simultaneously
									</li>
									<li>
										<strong>Delete:</strong> Remove multiple tasks (use
										carefully!)
									</li>
								</ul>
							</div>

							<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
								<p className="text-foreground">
									<strong>Use Case:</strong> End of week? Select all completed
									tasks, add #done-this-week tag, then review them for your
									weekly wins celebration!
								</p>
							</div>
						</div>
					</GuideSection>

					{/* Dashboard & Analytics */}
					<GuideSection
						icon={<BarChart3Icon className="h-5 w-5" />}
						title="Dashboard & Analytics"
						expanded={expandedSections.dashboard}
						onToggle={() => toggleSection("dashboard")}
					>
						<div className="space-y-4 text-sm">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Understanding Metrics
								</h4>
								<ul className="space-y-2 text-foreground-muted">
									<li>
										<strong>Completion Rate:</strong> Percentage of tasks
										completed. Aim for 70-80% (not 100%—that means you're not
										challenging yourself!)
									</li>
									<li>
										<strong>Streaks:</strong> Consecutive days with completions.
										Build momentum!
									</li>
									<li>
										<strong>Quadrant Distribution:</strong> Where is your time
										going? Goal: 60-70% in Q2
									</li>
									<li>
										<strong>Tag Analytics:</strong> Which projects/contexts get
										most attention?
									</li>
									<li>
										<strong>Trends:</strong> 7/30/90 day views show patterns
										over time
									</li>
								</ul>
							</div>

							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Using Data for Improvement
								</h4>
								<div className="space-y-2 text-foreground-muted">
									<p>
										<strong>If Q1 is &gt;30%:</strong> You're firefighting too
										much. Schedule more Q2 planning time.
									</p>
									<p>
										<strong>If Q4 is &gt;10%:</strong> You're wasting time.
										Ruthlessly eliminate these tasks.
									</p>
									<p>
										<strong>If completion rate is &lt;50%:</strong> You're
										over-committing. Create fewer, more focused tasks.
									</p>
									<p>
										<strong>If streaks are inconsistent:</strong> Commit to
										completing at least one task daily, even small wins.
									</p>
								</div>
							</div>
						</div>
					</GuideSection>

					{/* Workflows & Best Practices */}
					<GuideSection
						icon={<TrendingUpIcon className="h-5 w-5" />}
						title="Workflows & Best Practices"
						expanded={expandedSections.workflows}
						onToggle={() => toggleSection("workflows")}
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
								<h5 className="font-semibold text-foreground mb-2">
									GTD Integration
								</h5>
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

					{/* Data & Privacy */}
					<GuideSection
						icon={<DatabaseIcon className="h-5 w-5" />}
						title="Data & Privacy"
						expanded={expandedSections.dataPrivacy}
						onToggle={() => toggleSection("dataPrivacy")}
					>
						<div className="space-y-4 text-sm">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Local-First Architecture
								</h4>
								<p className="text-foreground-muted">
									All your data stays on YOUR device. GSD uses IndexedDB
									(browser storage) to save tasks, settings, and preferences.
									Nothing is sent to any server. No tracking, no analytics, no
									cloud sync. Your tasks are private by design.
								</p>
							</div>

							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Backup Strategy
								</h4>
								<ul className="space-y-2 text-foreground-muted">
									<li>
										<strong>Weekly Exports:</strong> Settings → Export Tasks →
										Save JSON file
									</li>
									<li>
										<strong>Version Control:</strong> Name files with dates
										(e.g., gsd-backup-2025-10-12.json)
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
								<h4 className="font-semibold text-foreground mb-2">
									Import Options
								</h4>
								<p className="text-foreground-muted mb-2">
									When importing, choose:
								</p>
								<ul className="space-y-1 text-foreground-muted list-disc list-inside">
									<li>
										<strong>Merge:</strong> Add imported tasks to existing ones
										(safe for combining)
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
									GSD Task Manager is open source and auditable. View the code
									on GitHub to verify: zero network requests, zero tracking,
									zero data collection. Your productivity is your business.
								</p>
							</div>
						</div>
					</GuideSection>

					{/* Keyboard Shortcuts */}
					<GuideSection
						icon={<KeyboardIcon className="h-5 w-5" />}
						title="Keyboard Shortcuts & Power User Tips"
						expanded={expandedSections.shortcuts}
						onToggle={() => toggleSection("shortcuts")}
					>
						<div className="space-y-4 text-sm">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Essential Shortcuts
								</h4>
								<div className="space-y-2">
									<ShortcutRow shortcut="N" description="Create new task" />
									<ShortcutRow shortcut="/" description="Focus search bar" />
									<ShortcutRow
										shortcut="?"
										description="Open this user guide"
									/>
									<ShortcutRow shortcut="Esc" description="Close dialogs" />
								</div>
							</div>

							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Power User Tips
								</h4>
								<ul className="space-y-2 text-foreground-muted">
									<li>
										💡 Use tags strategically—they're your custom categories
									</li>
									<li>💡 Review Dashboard weekly to spot trends</li>
									<li>💡 Set recurring tasks for weekly/monthly reviews</li>
									<li>
										💡 Use subtasks for complex projects (keeps main list clean)
									</li>
									<li>💡 Create Smart Views for morning/afternoon routines</li>
									<li>
										💡 Batch similar tasks together (e.g., all #phone-calls at
										once)
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

					{/* PWA Features */}
					<GuideSection
						icon={<SmartphoneIcon className="h-5 w-5" />}
						title="PWA (Progressive Web App) Features"
						expanded={expandedSections.pwa}
						onToggle={() => toggleSection("pwa")}
					>
						<div className="space-y-4 text-sm">
							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Installing as an App
								</h4>
								<div className="space-y-2 text-foreground-muted">
									<p>
										<strong>Desktop (Chrome/Edge):</strong>
									</p>
									<ol className="list-decimal list-inside space-y-1 ml-2">
										<li>Click the install icon (⊕) in the address bar</li>
										<li>Or: Menu → Install GSD Task Manager</li>
										<li>App opens in its own window (no browser chrome)</li>
									</ol>

									<p className="mt-3">
										<strong>iOS (Safari):</strong>
									</p>
									<ol className="list-decimal list-inside space-y-1 ml-2">
										<li>Tap the Share button</li>
										<li>Scroll down and tap "Add to Home Screen"</li>
										<li>Tap "Add" in the top-right</li>
										<li>Icon appears on your home screen</li>
									</ol>

									<p className="mt-3">
										<strong>Android (Chrome):</strong>
									</p>
									<ol className="list-decimal list-inside space-y-1 ml-2">
										<li>Tap the menu (⋮) → "Add to Home screen"</li>
										<li>Or look for the install prompt at the bottom</li>
										<li>App behaves like a native app</li>
									</ol>
								</div>
							</div>

							<div>
								<h4 className="font-semibold text-foreground mb-2">
									Offline Capabilities
								</h4>
								<ul className="space-y-1 text-foreground-muted">
									<li>✅ Works completely offline (no internet required)</li>
									<li>✅ All features available offline</li>
									<li>✅ Data syncs when you reconnect (local-first design)</li>
									<li>✅ Service worker caches app for instant loading</li>
								</ul>
							</div>

							<div>
								<h4 className="font-semibold text-foreground mb-2">
									PWA Benefits
								</h4>
								<ul className="space-y-1 text-foreground-muted">
									<li>🚀 Faster loading (cached assets)</li>
									<li>📱 No app store required</li>
									<li>🔔 Browser notifications for due tasks</li>
									<li>🏠 Home screen icon for quick access</li>
									<li>💾 No installation size (runs in browser)</li>
									<li>🔄 Auto-updates when you visit</li>
								</ul>
							</div>
						</div>
					</GuideSection>

					{/* Final Tips */}
					<div className="rounded-lg bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 p-4 mt-4">
						<div className="flex items-start gap-3">
							<LightbulbIcon className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
							<div className="space-y-2 text-sm">
								<h4 className="font-semibold text-foreground">
									Remember: The Matrix is a Tool, Not a Rule
								</h4>
								<p className="text-foreground-muted">
									There's no "perfect" way to use GSD. Experiment with
									workflows, adjust quadrants as you learn, and adapt the system
									to your life. The goal isn't perfect categorization—it's
									intentional action toward what matters most.
								</p>
								<p className="text-foreground-muted">
									<strong>Start small.</strong> Master one section at a time.
									Even using just the basic matrix will transform your
									productivity. The advanced features are here when you're
									ready.
								</p>
								<p className="text-accent font-medium">
									Now go get stuff done! 🚀
								</p>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Helper Components

interface GuideSectionProps {
	icon: React.ReactNode;
	title: string;
	expanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}

function GuideSection({
	icon,
	title,
	expanded,
	onToggle,
	children,
}: GuideSectionProps) {
	return (
		<Collapsible open={expanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80 transition-colors">
				<div className="flex items-center gap-3">
					<div className="text-accent">{icon}</div>
					<span className="font-semibold text-foreground">{title}</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${expanded ? "rotate-90" : ""}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}

interface QuadrantGuideProps {
	title: string;
	color: string;
	description: string;
	examples: string[];
	strategy: string;
	timeAllocation: string;
}

function QuadrantGuide({
	title,
	color,
	description,
	examples,
	strategy,
	timeAllocation,
}: QuadrantGuideProps) {
	return (
		<div className="rounded-lg border border-card-border bg-background-muted/30 p-4">
			<div className="flex items-center justify-between mb-2">
				<span className={`rounded px-3 py-1 text-sm font-semibold ${color}`}>
					{title}
				</span>
				<span className="text-xs font-medium text-foreground-muted">
					Target: {timeAllocation}
				</span>
			</div>
			<p className="text-sm text-foreground-muted mb-2">{description}</p>
			<div className="text-xs text-foreground-muted mb-2">
				<strong>Examples:</strong>
				<ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
					{examples.map((example, idx) => (
						<li key={idx}>{example}</li>
					))}
				</ul>
			</div>
			<div className="text-xs bg-background rounded p-2 border border-border">
				<strong className="text-accent">Strategy:</strong>{" "}
				<span className="text-foreground-muted">{strategy}</span>
			</div>
		</div>
	);
}

interface FeatureBlockProps {
	title: string;
	items: string[];
}

function FeatureBlock({ title, items }: FeatureBlockProps) {
	return (
		<div>
			<h4 className="font-semibold text-foreground mb-2">{title}</h4>
			<ul className="space-y-1 text-foreground-muted list-disc list-inside">
				{items.map((item, idx) => (
					<li key={idx}>{item}</li>
				))}
			</ul>
		</div>
	);
}

interface AdvancedFeatureProps {
	icon: React.ReactNode;
	title: string;
	description: string;
	children: React.ReactNode;
}

function AdvancedFeature({
	icon,
	title,
	description,
	children,
}: AdvancedFeatureProps) {
	return (
		<div className="rounded-lg border border-card-border bg-background-muted/30 p-4">
			<div className="flex items-center gap-2 mb-2">
				<div className="text-accent">{icon}</div>
				<h4 className="font-semibold text-foreground">{title}</h4>
			</div>
			<p className="text-sm text-foreground-muted mb-3">{description}</p>
			{children}
		</div>
	);
}

interface WorkflowBlockProps {
	title: string;
	steps: string[];
}

function WorkflowBlock({ title, steps }: WorkflowBlockProps) {
	return (
		<div className="rounded-lg border border-card-border bg-background-muted/30 p-4">
			<h4 className="font-semibold text-foreground mb-2">{title}</h4>
			<ol className="space-y-1 text-foreground-muted list-decimal list-inside">
				{steps.map((step, idx) => (
					<li key={idx}>{step}</li>
				))}
			</ol>
		</div>
	);
}

interface ShortcutRowProps {
	shortcut: string;
	description: string;
}

function ShortcutRow({ shortcut, description }: ShortcutRowProps) {
	return (
		<div className="flex items-center justify-between rounded-lg bg-background-muted px-3 py-2">
			<span className="text-foreground">{description}</span>
			<kbd className="rounded border border-border bg-background px-2 py-1 text-xs font-mono text-foreground-muted">
				{shortcut}
			</kbd>
		</div>
	);
}
