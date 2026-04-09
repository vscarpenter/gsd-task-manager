import type { TaskRecord } from "@/lib/types";
import { formatDueDate } from "@/lib/utils";

/**
 * Check if the Web Share API is available
 * Supported on mobile browsers (iOS Safari 12.2+, Chrome Android 61+)
 */
export function canUseWebShare(): boolean {
	return typeof navigator !== "undefined" && navigator.share !== undefined;
}

// ============================================================================
// Task Formatting Helpers
// Each helper handles one section, keeping functions under 30 lines
// ============================================================================

/** Format task header with title */
export function formatTaskHeader(task: TaskRecord): string[] {
	return [`Task: ${task.title}`, ""];
}

/** Format optional task description */
export function formatTaskDescription(task: TaskRecord): string[] {
	if (!task.description) return [];
	return ["Description:", task.description, ""];
}

/** Format task metadata: status, priority, due date, tags */
export function formatTaskMetadata(task: TaskRecord): string[] {
	const lines: string[] = ["Details:"];
	lines.push(`Status: ${task.completed ? "Completed" : "To Do"}`);

	const priority = task.urgent && task.important
		? "Urgent & Important"
		: task.urgent ? "Urgent" : task.important ? "Important" : "Low Priority";
	lines.push(`Priority: ${priority}`);

	if (task.dueDate) {
		lines.push(`Due: ${formatDueDate(task.dueDate)}`);
	}
	if (task.tags.length > 0) {
		lines.push(`Tags: ${task.tags.join(", ")}`);
	}
	return lines;
}

/** Format subtasks list with checkboxes */
export function formatTaskSubtasks(task: TaskRecord): string[] {
	if (task.subtasks.length === 0) return [];
	const lines = ["", "Subtasks:"];
	task.subtasks.forEach((subtask) => {
		lines.push(`  ${subtask.completed ? "\u2611" : "\u2610"} ${subtask.title}`);
	});
	return lines;
}

/** Format footer with creation date and attribution */
export function formatTaskFooter(task: TaskRecord): string[] {
	return [
		"",
		`Created: ${new Date(task.createdAt).toLocaleDateString()}`,
		"",
		"Sent from GSD Task Manager (https://gsd.vinny.dev)",
	];
}

/** Compose all sections into complete task details */
export function formatTaskDetails(task: TaskRecord): string {
	return [
		...formatTaskHeader(task),
		...formatTaskDescription(task),
		...formatTaskMetadata(task),
		...formatTaskSubtasks(task),
		...formatTaskFooter(task),
	].join("\n");
}
