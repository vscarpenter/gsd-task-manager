/* eslint-disable react/no-unescaped-entities */
"use client";

import { GridIcon } from "lucide-react";
import { GuideSection, QuadrantBlock } from "./shared-components";

interface MatrixSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function MatrixSection({ expanded, onToggle }: MatrixSectionProps) {
	return (
		<GuideSection
			icon={<GridIcon className="h-5 w-5" />}
			title="The Eisenhower Matrix Deep Dive"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4">
				<div>
					<h4 className="font-semibold text-foreground mb-2">The Philosophy</h4>
					<p className="text-sm text-foreground-muted">
						President Eisenhower said:{" "}
						<em>
							"What is important is seldom urgent, and what is urgent is seldom
							important."
						</em>
						This matrix helps you distinguish between the two and act
						accordingly.
					</p>
				</div>

				<div className="space-y-3">
					<QuadrantBlock
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

					<QuadrantBlock
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

					<QuadrantBlock
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

					<QuadrantBlock
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
						Many people spend 80% of time in Q1, firefighting constantly. This
						leads to burnout. The solution? Schedule Q2 time daily (even 30
						minutes) to prevent future Q1 crises.
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
