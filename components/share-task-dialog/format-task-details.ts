import type { TaskRecord } from "@/lib/types";
import { formatDueDate } from "@/lib/utils";

export function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function formatTaskHeader(task: TaskRecord): string[] {
  return [`Task: ${task.title}`, ""];
}

export function formatTaskDescription(task: TaskRecord): string[] {
  if (!task.description) return [];
  return ["Description:", task.description, ""];
}

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

export function formatTaskSubtasks(task: TaskRecord): string[] {
  if (task.subtasks.length === 0) return [];
  const lines = ["", "Subtasks:"];
  task.subtasks.forEach((subtask) => {
    lines.push(`  ${subtask.completed ? "☑" : "☐"} ${subtask.title}`);
  });
  return lines;
}

export function formatTaskFooter(task: TaskRecord): string[] {
  return [
    "",
    `Created: ${new Date(task.createdAt).toLocaleDateString()}`,
    "",
    "Sent from GSD Task Manager (https://gsd.vinny.dev)",
  ];
}

export function formatTaskDetails(task: TaskRecord): string {
  return [
    ...formatTaskHeader(task),
    ...formatTaskDescription(task),
    ...formatTaskMetadata(task),
    ...formatTaskSubtasks(task),
    ...formatTaskFooter(task),
  ].join("\n");
}
