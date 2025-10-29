/* eslint-disable react/no-unescaped-entities */
"use client";

import { BarChart3Icon } from "lucide-react";
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
							<strong>Quadrant Distribution:</strong> Where is your time going?
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

				<div>
					<h4 className="font-semibold text-foreground mb-2">
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
					</div>
				</div>
			</div>
		</GuideSection>
	);
}
