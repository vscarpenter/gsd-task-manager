/**
 * Type definitions for write operations
 */

import type { DecryptedTask } from '../types.js';

/**
 * Common options for write operations
 */
export interface WriteOptions {
  dryRun?: boolean; // If true, validate without persisting
}

/**
 * Task creation input
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string; // ISO datetime string, optional
  tags?: string[];
  subtasks?: Array<{ title: string; completed: boolean }>;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies?: string[];
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
  dueDate?: string; // ISO datetime string, optional
  tags?: string[];
  subtasks?: Array<{ id: string; title: string; completed: boolean }>;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies?: string[];
  completed?: boolean;
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
  | { type: 'set_due_date'; dueDate?: string } // ISO datetime string, optional
  | { type: 'delete' };

/**
 * Sync operation for pushing to Supabase
 * For create/update: carries plaintext task data (pushToSync handles encryption)
 * For delete: only needs taskId
 */
export type SyncOperation =
  | { type: 'create' | 'update'; taskId: string; data: DecryptedTask }
  | { type: 'delete'; taskId: string };
