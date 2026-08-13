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
  /** True when a search query or smart view is narrowing the board. */
  isFiltered: boolean;
  /** How many tasks survived the filter. Zero means "no matches", not "no tasks". */
  matchCount: number;
}

/** Tally the header figures for whichever set is actually on screen. */
function tally(tasks: TaskRecord[]): { total: number; completed: number; overdue: number } {
  const todayIso = new Date().toISOString().slice(0, 10);
  let completed = 0;
  let overdue = 0;

  for (const task of tasks) {
    if (task.completed) completed += 1;
    else if (task.dueDate && task.dueDate < todayIso) overdue += 1;
  }

  return { total: tasks.length, completed, overdue };
}

/**
 * Derive the visible task list and header counts.
 *
 * Base set: an active smart view (when the feature is enabled) filters the full
 * task set; otherwise the base is all tasks when "show completed" is on, or just
 * the active (incomplete) tasks. The search query is applied last.
 *
 * The counts describe what is on screen, not what is in the database. A header
 * reading "5 active" above a board showing nothing is how a filtered board comes
 * to look broken rather than filtered.
 */
export function deriveMatrixView({
  all,
  showCompleted,
  smartViewsEnabled,
  activeSmartView,
  searchQuery,
}: MatrixViewInput): MatrixView {
  const activeTasks = all.filter((task) => !task.completed);

  const effectiveSmartView = smartViewsEnabled ? activeSmartView : null;
  const base = effectiveSmartView ? all : showCompleted ? all : activeTasks;
  const smartViewTasks = effectiveSmartView
    ? applyFilters(base, effectiveSmartView.criteria, all)
    : base;

  const visibleTasks = filterTasks(smartViewTasks, searchQuery);
  const isFiltered = Boolean(effectiveSmartView) || searchQuery.trim().length > 0;
  const counted = isFiltered ? visibleTasks : all;

  return {
    visibleTasks,
    ...tally(counted),
    isFiltered,
    matchCount: visibleTasks.length,
  };
}
