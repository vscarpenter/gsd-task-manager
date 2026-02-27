import { z } from 'zod';

// Configuration
export interface GsdConfig {
  supabaseUrl: string;
  serviceKey: string;
  userEmail: string;
  encryptionPassphrase?: string; // Optional: for decrypting tasks
}

// Supabase encrypted_tasks row schema
export const encryptedTaskRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  encrypted_blob: z.string(),
  nonce: z.string(),
  version: z.number(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_modified_device: z.string().nullable(),
  checksum: z.string(),
});

export type EncryptedTaskRow = z.infer<typeof encryptedTaskRowSchema>;

// Response schemas for tool output
export const syncStatusSchema = z.object({
  lastSyncAt: z.number().nullable(),
  pendingPushCount: z.number(),
  pendingPullCount: z.number(),
  conflictCount: z.number(),
  deviceCount: z.number(),
  storageUsed: z.number(),
  storageQuota: z.number(),
});

export const deviceSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  lastSeenAt: z.number(),
  isActive: z.boolean(),
  isCurrent: z.boolean(),
});

export const taskStatsSchema = z.object({
  totalTasks: z.number().nullable(),
  activeTasks: z.number().nullable(),
  deletedTasks: z.number().nullable(),
  lastUpdated: z.number().nullable(),
  oldestTask: z.number().nullable(),
  newestTask: z.number().nullable(),
});

export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type TaskStats = z.infer<typeof taskStatsSchema>;

// Legacy alias for backward compatibility in re-exports
export const encryptedTaskBlobSchema = encryptedTaskRowSchema;
export type EncryptedTaskBlob = EncryptedTaskRow;

// Decrypted task structure (matches GSD TaskRecord from frontend)
export interface DecryptedTask {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrant: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  tags: string[];
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

// Task filters
export interface TaskFilters {
  quadrant?: string;
  completed?: boolean;
  tags?: string[];
}
