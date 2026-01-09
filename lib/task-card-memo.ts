/**
 * Task Card Memo Comparison Helpers
 *
 * Extracted from components/task-card.tsx for better code organization.
 * Provides efficient comparison functions for React.memo optimization.
 */

import type { TaskRecord } from "@/lib/types";

/**
 * Props interface for TaskCard component
 * This is the canonical definition, imported by components/task-card.tsx
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

/** Compare string arrays element-by-element (faster than JSON.stringify) */
function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Compare subtask arrays by checking each property */
function areSubtasksEqual(a: TaskRecord['subtasks'], b: TaskRecord['subtasks']): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].title !== b[i].title || a[i].completed !== b[i].completed) {
      return false;
    }
  }
  return true;
}

/** Check if arrays (tags, subtasks, dependencies) changed */
function haveArraysChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prev = prevProps.task;
  const next = nextProps.task;
  return (
    !areStringArraysEqual(prev.tags, next.tags) ||
    !areSubtasksEqual(prev.subtasks, next.subtasks) ||
    !areStringArraysEqual(prev.dependencies, next.dependencies)
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
