/* eslint-disable react/no-unescaped-entities */
"use client";

import { BarChart3Icon, ClockIcon, TargetIcon } from "lucide-react";
import { GuideSection } from "./shared-components";

interface DashboardSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function DashboardSection({
	expanded,
	onToggle,
}: DashboardSectionProps) {
	return (
		<GuideSection
			icon={<BarChart3Icon className="h-5 w-5" />}
			title="Dashboard & Analytics"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Understanding Metrics
					</h4>
					<ul className="space-y-2 text-foreground-muted">
						<li>
							<strong>Completion Rate:</strong> Percentage of tasks completed.
							Aim for 70-80% (not 100%—that means you're not challenging
							yourself!)
						</li>
						<li>
							<strong>Streaks:</strong> Consecutive days with completions. Build
							momentum!
						</li>
						<li>
							<strong>Quadrant Distribution:</strong> Where are your tasks going?
							Goal: 60-70% in Q2
						</li>
						<li>
							<strong>Tag Analytics:</strong> Which projects/contexts get most
							attention?
						</li>
						<li>
							<strong>Trends:</strong> 7/30/90 day views show patterns over time
						</li>
					</ul>
				</div>

				{/* Time Analytics Section */}
				<div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3">
					<h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
						<ClockIcon className="h-4 w-4 text-blue-600" />
						Time Tracking Analytics
					</h4>
					<ul className="space-y-2 text-foreground-muted">
						<li>
							<strong>Total Tracked:</strong> How much time you've actively
							logged
						</li>
						<li>
							<strong>Time by Quadrant:</strong> See where your hours actually
							go (visual breakdown)
						</li>
						<li>
							<strong>Estimation Accuracy:</strong> Compare estimates vs actual
							time
							<ul className="ml-4 mt-1 space-y-0.5 text-xs">
								<li>• 80-120% = Good (on target)</li>
								<li>• &lt;80% = Under-estimating</li>
								<li>• &gt;120% = Over-estimating</li>
							</ul>
						</li>
						<li>
							<strong>Running Timers:</strong> See how many tasks are being
							tracked right now
						</li>
					</ul>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
						<TargetIcon className="h-4 w-4" />
						Using Data for Improvement
					</h4>
					<div className="space-y-2 text-foreground-muted">
						<p>
							<strong>If Q1 is &gt;30%:</strong> You're firefighting too much.
							Schedule more Q2 planning time.
						</p>
						<p>
							<strong>If Q4 is &gt;10%:</strong> You're wasting time. Ruthlessly
							eliminate these tasks.
						</p>
						<p>
							<strong>If completion rate is &lt;50%:</strong> You're
							over-committing. Create fewer, more focused tasks.
						</p>
						<p>
							<strong>If streaks are inconsistent:</strong> Commit to completing
							at least one task daily, even small wins.
						</p>
						<p>
							<strong>If estimation accuracy is off:</strong> Track more tasks
							to calibrate your time sense over weeks.
						</p>
					</div>
				</div>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<p className="text-foreground">
						<strong>📊 Pro tip:</strong> Review your Dashboard weekly. Look for
						patterns: Are you spending too much time in Q1 (urgent)? Is one tag
						consuming all your energy? Use insights to rebalance your week.
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
