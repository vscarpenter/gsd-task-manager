import type { QuadrantId, RecurrenceType, TaskRecord } from "@/lib/types";
import { isOverdue, isDueToday, isDueThisWeek } from "@/lib/utils";
import { TIME_MS } from "@/lib/constants";
import { getUncompletedBlockingTasks } from "@/lib/dependencies";
import type { FilterCriteria } from "@/lib/smart-views/types";

export type { QuadrantId, RecurrenceType };
export type { FilterCriteria, SmartView } from "@/lib/smart-views/types";

// Re-export BUILT_IN_SMART_VIEWS from extracted module for backward compatibility
export { BUILT_IN_SMART_VIEWS } from "@/lib/smart-views/built-in";

function filterByQuadrants(tasks: TaskRecord[], quadrants?: QuadrantId[]): TaskRecord[] {
  if (!quadrants || quadrants.length === 0) return tasks;
  return tasks.filter(task => quadrants.includes(task.quadrant));
}

function filterByStatus(tasks: TaskRecord[], status?: 'all' | 'active' | 'completed'): TaskRecord[] {
  if (!status || status === 'all') return tasks;
  return tasks.filter(task => status === 'completed' ? task.completed : !task.completed);
}

/** Filter tasks that have ALL specified tags */
function filterByTags(tasks: TaskRecord[], tags?: string[]): TaskRecord[] {
  if (!tags || tags.length === 0) return tasks;
  return tasks.filter(task => tags.every(tag => task.tags.includes(tag)));
}

function filterByDueDateRange(tasks: TaskRecord[], range?: { start?: string; end?: string }): TaskRecord[] {
  if (!range) return tasks;
  const { start, end } = range;
  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    if (start && dueDate < new Date(start)) return false;
    if (end && dueDate > new Date(end)) return false;
    return true;
  });
}

function filterByOverdue(tasks: TaskRecord[], overdue?: boolean): TaskRecord[] {
  if (!overdue) return tasks;
  return tasks.filter(task => !task.completed && isOverdue(task.dueDate));
}

function filterByDueToday(tasks: TaskRecord[], dueToday?: boolean): TaskRecord[] {
  if (!dueToday) return tasks;
  return tasks.filter(task => !task.completed && isDueToday(task.dueDate));
}

/** Filter for tasks due within the current week */
function filterByDueThisWeek(tasks: TaskRecord[], dueThisWeek?: boolean): TaskRecord[] {
  if (!dueThisWeek) return tasks;
  return tasks.filter(task => !task.completed && isDueThisWeek(task.dueDate));
}

function filterByNoDueDate(tasks: TaskRecord[], noDueDate?: boolean): TaskRecord[] {
  if (!noDueDate) return tasks;
  return tasks.filter(task => !task.dueDate);
}

function filterByRecurrence(tasks: TaskRecord[], recurrence?: RecurrenceType[]): TaskRecord[] {
  if (!recurrence || recurrence.length === 0) return tasks;
  return tasks.filter(task => recurrence.includes(task.recurrence));
}

/** Filter tasks created within the last 7 days */
function filterByRecentlyAdded(tasks: TaskRecord[], recentlyAdded?: boolean): TaskRecord[] {
  if (!recentlyAdded) return tasks;
  const sevenDaysAgo = new Date(Date.now() - TIME_MS.WEEK);
  return tasks.filter(task => new Date(task.createdAt) >= sevenDaysAgo);
}

/** Filter tasks completed within the last 7 days */
function filterByRecentlyCompleted(tasks: TaskRecord[], recentlyCompleted?: boolean): TaskRecord[] {
  if (!recentlyCompleted) return tasks;
  const sevenDaysAgo = new Date(Date.now() - TIME_MS.WEEK);
  return tasks.filter(task => {
    if (!task.completed || !task.completedAt) return false;
    return new Date(task.completedAt) >= sevenDaysAgo;
  });
}

/** Filter tasks that have no uncompleted blocking dependencies (ready to work) */
function filterByReadyToWork(tasks: TaskRecord[], allTasks: TaskRecord[], readyToWork?: boolean): TaskRecord[] {
  if (!readyToWork) return tasks;
  return tasks.filter(task => {
    const blockingTasks = getUncompletedBlockingTasks(task, allTasks);
    return blockingTasks.length === 0;
  });
}

/** Filter tasks by search query across title, description, tags, and subtasks */
function filterBySearchQuery(tasks: TaskRecord[], searchQuery?: string): TaskRecord[] {
  if (!searchQuery || !searchQuery.trim()) return tasks;
  const query = searchQuery.trim().toLowerCase();
  return tasks.filter(task => {
    const searchableText = [
      task.title,
      task.description,
      task.quadrant,
      task.dueDate ?? "",
      ...task.tags,
      ...task.subtasks.map(st => st.title)
    ].join(" ").toLowerCase();
    return searchableText.includes(query);
  });
}

/**
 * Apply filter criteria to a list of tasks
 * Composes individual filter functions for maintainability
 * @param tasks - The tasks to filter
 * @param criteria - The filter criteria to apply
 * @param allTasks - Optional: all tasks in the system (needed for dependency-based filters like readyToWork)
 */
export function applyFilters(tasks: TaskRecord[], criteria: FilterCriteria, allTasks?: TaskRecord[]): TaskRecord[] {
  let result = [...tasks];

  result = filterByQuadrants(result, criteria.quadrants);
  result = filterByStatus(result, criteria.status);
  result = filterByTags(result, criteria.tags);
  result = filterByDueDateRange(result, criteria.dueDateRange);
  result = filterByOverdue(result, criteria.overdue);
  result = filterByDueToday(result, criteria.dueToday);
  result = filterByDueThisWeek(result, criteria.dueThisWeek);
  result = filterByNoDueDate(result, criteria.noDueDate);
  result = filterByRecurrence(result, criteria.recurrence);
  result = filterByRecentlyAdded(result, criteria.recentlyAdded);
  result = filterByRecentlyCompleted(result, criteria.recentlyCompleted);
  result = filterByReadyToWork(result, allTasks ?? tasks, criteria.readyToWork);
  result = filterBySearchQuery(result, criteria.searchQuery);

  return result;
}
