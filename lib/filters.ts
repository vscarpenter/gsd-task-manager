import type { QuadrantId, RecurrenceType, TaskRecord } from "@/lib/types";
import { isOverdue, isDueToday, isDueThisWeek } from "@/lib/utils";
import { TIME_MS } from "@/lib/constants";

// Re-export types for convenience
export type { QuadrantId, RecurrenceType };

/**
 * Criteria for filtering tasks
 */
export interface FilterCriteria {
  // Quadrant filters
  quadrants?: QuadrantId[];

  // Status filters
  status?: 'all' | 'active' | 'completed';

  // Tag filters
  tags?: string[];

  // Due date filters
  dueDateRange?: {
    start?: string; // ISO date string
    end?: string;   // ISO date string
  };
  overdue?: boolean;
  dueToday?: boolean;
  dueThisWeek?: boolean;
  noDueDate?: boolean; // Filter for tasks without due dates

  // Recurrence filters
  recurrence?: RecurrenceType[];

  // Date-based filters
  recentlyAdded?: boolean; // Tasks created in the last 7 days
  recentlyCompleted?: boolean; // Tasks completed in the last 7 days

  // Text search
  searchQuery?: string;
}

/**
 * Smart View - saved filter combinations
 */
export interface SmartView {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  criteria: FilterCriteria;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Individual Filter Functions
// Each function handles one filter criterion, keeping functions under 30 lines
// ============================================================================

/** Filter tasks by quadrant membership */
function filterByQuadrants(tasks: TaskRecord[], quadrants?: QuadrantId[]): TaskRecord[] {
  if (!quadrants || quadrants.length === 0) return tasks;
  return tasks.filter(task => quadrants.includes(task.quadrant));
}

/** Filter tasks by completion status */
function filterByStatus(tasks: TaskRecord[], status?: 'all' | 'active' | 'completed'): TaskRecord[] {
  if (!status || status === 'all') return tasks;
  return tasks.filter(task => status === 'completed' ? task.completed : !task.completed);
}

/** Filter tasks that have ALL specified tags */
function filterByTags(tasks: TaskRecord[], tags?: string[]): TaskRecord[] {
  if (!tags || tags.length === 0) return tasks;
  return tasks.filter(task => tags.every(tag => task.tags.includes(tag)));
}

/** Filter tasks within a date range */
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

/** Filter for overdue tasks only */
function filterByOverdue(tasks: TaskRecord[], overdue?: boolean): TaskRecord[] {
  if (!overdue) return tasks;
  return tasks.filter(task => !task.completed && isOverdue(task.dueDate));
}

/** Filter for tasks due today */
function filterByDueToday(tasks: TaskRecord[], dueToday?: boolean): TaskRecord[] {
  if (!dueToday) return tasks;
  return tasks.filter(task => !task.completed && isDueToday(task.dueDate));
}

/** Filter for tasks due within the current week */
function filterByDueThisWeek(tasks: TaskRecord[], dueThisWeek?: boolean): TaskRecord[] {
  if (!dueThisWeek) return tasks;
  return tasks.filter(task => !task.completed && isDueThisWeek(task.dueDate));
}

/** Filter for tasks without due dates */
function filterByNoDueDate(tasks: TaskRecord[], noDueDate?: boolean): TaskRecord[] {
  if (!noDueDate) return tasks;
  return tasks.filter(task => !task.dueDate);
}

/** Filter tasks by recurrence type */
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

// ============================================================================
// Main Filter Function
// Composes individual filters using a pipeline pattern
// ============================================================================

/**
 * Apply filter criteria to a list of tasks
 * Composes individual filter functions for maintainability
 */
export function applyFilters(tasks: TaskRecord[], criteria: FilterCriteria): TaskRecord[] {
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
  result = filterBySearchQuery(result, criteria.searchQuery);

  return result;
}

/**
 * Built-in Smart Views that come with the app
 */
export const BUILT_IN_SMART_VIEWS: Omit<SmartView, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Today's Focus",
    description: "All urgent and important tasks - your top priorities",
    icon: "🎯",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      quadrants: ['urgent-important']
    }
  },
  {
    name: "This Week",
    description: "Tasks needing attention this week (overdue + next 7 days)",
    icon: "📅",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      dueThisWeek: true
    }
  },
  {
    name: "Overdue Backlog",
    description: "All overdue tasks across quadrants",
    icon: "⚠️",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      overdue: true
    }
  },
  {
    name: "No Deadline",
    description: "Tasks without due dates for planning",
    icon: "📋",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      noDueDate: true
    }
  },
  {
    name: "Recently Added",
    description: "Tasks created in the last 7 days",
    icon: "✨",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      recentlyAdded: true
    }
  },
  {
    name: "This Week's Wins",
    description: "Completed tasks from the last 7 days",
    icon: "🏆",
    isBuiltIn: true,
    criteria: {
      status: 'completed',
      recentlyCompleted: true
    }
  },
  {
    name: "All Completed",
    description: "All completed tasks across all time",
    icon: "✅",
    isBuiltIn: true,
    criteria: {
      status: 'completed'
    }
  },
  {
    name: "Recurring Tasks",
    description: "All tasks with recurrence enabled",
    icon: "🔁",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      recurrence: ['daily', 'weekly', 'monthly']
    }
  }
];

/**
 * Check if filter criteria is empty (no filters applied)
 */
export function isEmptyFilter(criteria: FilterCriteria): boolean {
  return (
    (!criteria.quadrants || criteria.quadrants.length === 0) &&
    (!criteria.status || criteria.status === 'all') &&
    (!criteria.tags || criteria.tags.length === 0) &&
    !criteria.dueDateRange &&
    !criteria.overdue &&
    !criteria.dueToday &&
    !criteria.dueThisWeek &&
    !criteria.noDueDate &&
    (!criteria.recurrence || criteria.recurrence.length === 0) &&
    !criteria.recentlyAdded &&
    !criteria.recentlyCompleted &&
    (!criteria.searchQuery || criteria.searchQuery.trim() === '')
  );
}

/**
 * Get a human-readable description of active filters
 */
export function getFilterDescription(criteria: FilterCriteria): string {
  const parts: string[] = [];

  if (criteria.quadrants && criteria.quadrants.length > 0) {
    parts.push(`${criteria.quadrants.length} quadrant${criteria.quadrants.length > 1 ? 's' : ''}`);
  }

  if (criteria.status && criteria.status !== 'all') {
    parts.push(criteria.status);
  }

  if (criteria.tags && criteria.tags.length > 0) {
    parts.push(`${criteria.tags.length} tag${criteria.tags.length > 1 ? 's' : ''}`);
  }

  if (criteria.overdue) parts.push('overdue');
  if (criteria.dueToday) parts.push('due today');
  if (criteria.dueThisWeek) parts.push('due this week');
  if (criteria.noDueDate) parts.push('no due date');

  if (criteria.recurrence && criteria.recurrence.length > 0) {
    parts.push(`${criteria.recurrence.join(', ')} recurrence`);
  }

  if (criteria.recentlyAdded) parts.push('recently added');
  if (criteria.recentlyCompleted) parts.push('recently completed');

  if (criteria.searchQuery && criteria.searchQuery.trim()) {
    parts.push(`"${criteria.searchQuery.trim()}"`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No filters';
}
