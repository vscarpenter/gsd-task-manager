/**
 * Type definitions for write operations
 */

/**
 * Common options for write operations
 */
export interface WriteOptions {
  dryRun?: boolean;
}

/**
 * Task creation input
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  tags?: string[];
  subtasks?: Array<{ title: string; completed: boolean }>;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies?: string[];
  notifyBefore?: number;
  notificationEnabled?: boolean;
  estimatedMinutes?: number;
  dryRun?: boolean;
}

/**
 * Task update input (partial)
 */
export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  urgent?: boolean;
  important?: boolean;
  dueDate?: string;
  tags?: string[];
  subtasks?: Array<{ id: string; title: string; completed: boolean }>;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies?: string[];
  completed?: boolean;
  notifyBefore?: number;
  notificationEnabled?: boolean;
  estimatedMinutes?: number;
  dryRun?: boolean;
}

/**
 * Bulk update operation types
 */
export type BulkOperation =
  | { type: 'complete'; completed: boolean }
  | { type: 'move_quadrant'; urgent: boolean; important: boolean }
  | { type: 'add_tags'; tags: string[] }
  | { type: 'remove_tags'; tags: string[] }
  | { type: 'set_due_date'; dueDate?: string }
  | { type: 'delete' };
