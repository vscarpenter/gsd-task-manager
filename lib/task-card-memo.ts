/**
 * Task Card Memo Comparison Helpers
 *
 * Extracted from components/task-card.tsx for better code organization.
 * Provides efficient comparison functions for React.memo optimization.
 */

import type { TaskRecord } from "@/lib/types";

/**
 * Props interface for TaskCard component (duplicated here for type safety)
 */
export interface TaskCardProps {
  task: TaskRecord;
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
  onStartTimer?: (taskId: string) => Promise<void>;
  onStopTimer?: (taskId: string) => Promise<void>;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (task: TaskRecord) => void;
  taskRef?: (el: HTMLElement | null) => void;
  isHighlighted?: boolean;
}

// ============================================================================
// Memo Comparison Helpers
// Each helper handles one aspect of comparison, keeping functions under 30 lines
// ============================================================================

/** Get IDs of tasks related to this task via dependencies */
function getRelatedDependencyIds(task: TaskRecord, allTasks: TaskRecord[]): Set<string> {
  return new Set([
    ...task.dependencies,
    ...allTasks.filter(t => t.dependencies.includes(task.id)).map(t => t.id)
  ]);
}

/** Check if dependency-related tasks changed in ways that affect rendering */
function haveDependenciesChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prevIds = getRelatedDependencyIds(prevProps.task, prevProps.allTasks);
  const nextIds = getRelatedDependencyIds(nextProps.task, nextProps.allTasks);

  if (prevIds.size !== nextIds.size) return true;

  for (const depId of prevIds) {
    const prevTask = prevProps.allTasks.find(t => t.id === depId);
    const nextTask = nextProps.allTasks.find(t => t.id === depId);
    if (!prevTask || !nextTask) return true;
    if (prevTask.completed !== nextTask.completed || prevTask.title !== nextTask.title) return true;
  }
  return false;
}

/** Check if core task properties changed */
function haveTaskPropertiesChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prev = prevProps.task;
  const next = nextProps.task;
  return (
    prev.id !== next.id ||
    prev.title !== next.title ||
    prev.description !== next.description ||
    prev.completed !== next.completed ||
    prev.urgent !== next.urgent ||
    prev.important !== next.important ||
    prev.dueDate !== next.dueDate ||
    prev.recurrence !== next.recurrence ||
    prev.updatedAt !== next.updatedAt
  );
}

/** Check if arrays (tags, subtasks, dependencies) changed */
function haveArraysChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prev = prevProps.task;
  const next = nextProps.task;
  return (
    prev.tags.length !== next.tags.length ||
    prev.subtasks.length !== next.subtasks.length ||
    prev.dependencies.length !== next.dependencies.length ||
    JSON.stringify(prev.tags) !== JSON.stringify(next.tags) ||
    JSON.stringify(prev.subtasks) !== JSON.stringify(next.subtasks) ||
    JSON.stringify(prev.dependencies) !== JSON.stringify(next.dependencies)
  );
}

/** Check if UI state props changed */
function hasUIStateChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  return (
    prevProps.selectionMode !== nextProps.selectionMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.allTasks.length !== nextProps.allTasks.length
  );
}

/**
 * Main comparison function for React.memo
 * Composed from smaller, focused helper functions
 * Returns true if props are equal (component should NOT re-render)
 */
export function areTaskCardPropsEqual(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  if (haveDependenciesChanged(prevProps, nextProps)) return false;
  if (haveTaskPropertiesChanged(prevProps, nextProps)) return false;
  if (haveArraysChanged(prevProps, nextProps)) return false;
  if (hasUIStateChanged(prevProps, nextProps)) return false;
  return true;
}
