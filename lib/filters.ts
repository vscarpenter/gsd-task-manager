import type { QuadrantId, RecurrenceType, TaskRecord } from "@/lib/types";
import { isOverdue, isDueToday, isDueThisWeek } from "@/lib/utils";

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

  // Recurrence filters
  recurrence?: RecurrenceType[];

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

/**
 * Apply filter criteria to a list of tasks
 */
export function applyFilters(tasks: TaskRecord[], criteria: FilterCriteria): TaskRecord[] {
  let filtered = [...tasks];

  // Filter by quadrants
  if (criteria.quadrants && criteria.quadrants.length > 0) {
    filtered = filtered.filter(task => criteria.quadrants!.includes(task.quadrant));
  }

  // Filter by status
  if (criteria.status && criteria.status !== 'all') {
    if (criteria.status === 'active') {
      filtered = filtered.filter(task => !task.completed);
    } else if (criteria.status === 'completed') {
      filtered = filtered.filter(task => task.completed);
    }
  }

  // Filter by tags (task must have ALL specified tags)
  if (criteria.tags && criteria.tags.length > 0) {
    filtered = filtered.filter(task =>
      criteria.tags!.every(tag => task.tags.includes(tag))
    );
  }

  // Filter by due date range
  if (criteria.dueDateRange) {
    const { start, end } = criteria.dueDateRange;
    filtered = filtered.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);

      if (start && dueDate < new Date(start)) return false;
      if (end && dueDate > new Date(end)) return false;

      return true;
    });
  }

  // Filter by overdue
  if (criteria.overdue) {
    filtered = filtered.filter(task => !task.completed && isOverdue(task.dueDate));
  }

  // Filter by due today
  if (criteria.dueToday) {
    filtered = filtered.filter(task => !task.completed && isDueToday(task.dueDate));
  }

  // Filter by due this week
  if (criteria.dueThisWeek) {
    filtered = filtered.filter(task => !task.completed && isDueThisWeek(task.dueDate));
  }

  // Filter by recurrence types
  if (criteria.recurrence && criteria.recurrence.length > 0) {
    filtered = filtered.filter(task => criteria.recurrence!.includes(task.recurrence));
  }

  // Filter by search query
  if (criteria.searchQuery && criteria.searchQuery.trim()) {
    const query = criteria.searchQuery.trim().toLowerCase();
    filtered = filtered.filter(task => {
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

  return filtered;
}

/**
 * Built-in Smart Views that come with the app
 */
export const BUILT_IN_SMART_VIEWS: Omit<SmartView, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Today's Focus",
    description: "Due today, overdue, and urgent+important tasks",
    icon: "🎯",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      quadrants: ['urgent-important'],
      dueToday: true,
      overdue: true
    }
  },
  {
    name: "This Week",
    description: "All tasks due within the next 7 days",
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
      dueDateRange: undefined // Tasks with no dueDate
    }
  },
  {
    name: "Recently Added",
    description: "Tasks created in the last 7 days",
    icon: "✨",
    isBuiltIn: true,
    criteria: {
      status: 'active'
      // Will need special handling for createdAt in the past 7 days
    }
  },
  {
    name: "Recently Completed",
    description: "Completed tasks from the last 7 days",
    icon: "✅",
    isBuiltIn: true,
    criteria: {
      status: 'completed'
      // Will need special handling for completed in the past 7 days
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
    (!criteria.recurrence || criteria.recurrence.length === 0) &&
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

  if (criteria.recurrence && criteria.recurrence.length > 0) {
    parts.push(`${criteria.recurrence.join(', ')} recurrence`);
  }

  if (criteria.searchQuery && criteria.searchQuery.trim()) {
    parts.push(`"${criteria.searchQuery.trim()}"`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No filters';
}
