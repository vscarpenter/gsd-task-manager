/**
 * Pure data derivation for the matrix view.
 *
 * Extracted from the MatrixSimplified component so the "which tasks are visible
 * and what are the header counts" logic can be unit-tested in isolation and the
 * component stays focused on wiring/rendering.
 */

import { applyFilters, type SmartView } from "@/lib/filters";
import type { TaskRecord } from "@/lib/types";

/** Case-insensitive search across title, description, tags, and subtasks. */
export function filterTasks(tasks: TaskRecord[], query: string): TaskRecord[] {
  const trimmed = query.trim();
  if (!trimmed) return tasks;
  const q = trimmed.toLowerCase();
  return tasks.filter((t) => {
    const hay = [
      t.title,
      t.description ?? "",
      (t.tags ?? []).join(" "),
      (t.subtasks ?? []).map((s) => s.title).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export interface MatrixViewInput {
  all: TaskRecord[];
  showCompleted: boolean;
  smartViewsEnabled: boolean;
  activeSmartView: SmartView | null;
  searchQuery: string;
}

export interface MatrixView {
  visibleTasks: TaskRecord[];
  total: number;
  completed: number;
  overdue: number;
}

/**
 * Derive the visible task list and header counts.
 *
 * Base set: an active smart view (when the feature is enabled) filters the full
 * task set; otherwise the base is all tasks when "show completed" is on, or just
 * the active (incomplete) tasks. The search query is applied last.
 */
export function deriveMatrixView({
  all,
  showCompleted,
  smartViewsEnabled,
  activeSmartView,
  searchQuery,
}: MatrixViewInput): MatrixView {
  const todayIso = new Date().toISOString().slice(0, 10);
  let completed = 0;
  let overdue = 0;
  const activeTasks: TaskRecord[] = [];

  for (const task of all) {
    if (task.completed) {
      completed += 1;
    } else {
      activeTasks.push(task);
      if (task.dueDate && task.dueDate < todayIso) {
        overdue += 1;
      }
    }
  }

  const effectiveSmartView = smartViewsEnabled ? activeSmartView : null;
  const base = effectiveSmartView ? all : showCompleted ? all : activeTasks;
  const smartViewTasks = effectiveSmartView
    ? applyFilters(base, effectiveSmartView.criteria, all)
    : base;

  return {
    visibleTasks: filterTasks(smartViewTasks, searchQuery),
    total: all.length,
    completed,
    overdue,
  };
}
