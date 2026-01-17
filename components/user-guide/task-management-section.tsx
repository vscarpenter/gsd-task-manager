"use client";

import { ListIcon } from "lucide-react";
import { GuideSection, FeatureBlock } from "./shared-components";

interface TaskManagementSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function TaskManagementSection({
	expanded,
	onToggle,
}: TaskManagementSectionProps) {
	return (
		<GuideSection
			icon={<ListIcon className="h-5 w-5" />}
			title="Core Task Management"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<FeatureBlock
					title="Creating Tasks"
					items={[
						"Click the + button or press N key",
						"Title should be action-oriented (start with a verb)",
						"Use description for context, not just details",
						"Set due dates for time-sensitive work",
						"Add time estimates to track estimation accuracy",
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
	);
}
