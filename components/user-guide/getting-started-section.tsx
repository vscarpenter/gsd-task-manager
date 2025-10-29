/* eslint-disable react/no-unescaped-entities */
"use client";

import { RocketIcon } from "lucide-react";
import { GuideSection } from "./shared-components";

interface GettingStartedSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function GettingStartedSection({
	expanded,
	onToggle,
}: GettingStartedSectionProps) {
	return (
		<GuideSection
			icon={<RocketIcon className="h-5 w-5" />}
			title="Getting Started"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4">
				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Welcome to GSD Task Manager!
					</h4>
					<p className="text-sm text-foreground-muted">
						GSD (Get Stuff Done) helps you prioritize what matters using the
						Eisenhower Matrix. This guide will help you master productivity and
						achieve your goals.
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
							Enter a clear, actionable title (e.g., "Review Q4 budget proposal")
						</li>
						<li>Add details in the description field</li>
						<li>
							Categorize: Is it <strong>Urgent</strong>? Is it{" "}
							<strong>Important</strong>?
						</li>
						<li>Optionally set a due date, add tags, or create subtasks</li>
						<li>
							Click <strong>Add Task</strong>
						</li>
					</ol>
				</div>

				<div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
					<p className="text-sm text-foreground">
						<strong>Pro Tip:</strong> Start with 5-10 tasks to get familiar with
						the matrix. Don't worry about perfect categorization—you can always
						move tasks later!
					</p>
				</div>
			</div>
		</GuideSection>
	);
}
