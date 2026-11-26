export interface WriteOptions {
  dryRun?: boolean;
}

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

/** What a delete would remove, for the person asked to confirm it. */
export interface DeletionPreview {
  titles: string[];
  /** Tasks outside the delete that depend on a task in it. */
  dependentCount: number;
  /** Each task's updatedAt as previewed. A confirmed delete keeps any task that has moved since. */
  stamps: Record<string, string>;
}

export type BulkOperation =
  | { type: 'complete'; completed: boolean }
  | { type: 'move_quadrant'; urgent: boolean; important: boolean }
  | { type: 'add_tags'; tags: string[] }
  | { type: 'remove_tags'; tags: string[] }
  | { type: 'set_due_date'; dueDate?: string }
  | { type: 'delete' };
