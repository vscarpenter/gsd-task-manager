/**
 * Type definitions for write operations
 */

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
 * Sync operation for push request
 */
export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  taskId: string;
  encryptedBlob?: string;
  nonce?: string;
  vectorClock: Record<string, number>;
  checksum?: string; // SHA-256 hash of plaintext JSON (required for create/update)
}
