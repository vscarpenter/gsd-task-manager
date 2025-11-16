import { z } from 'zod';

// Configuration
export interface GsdConfig {
  apiBaseUrl: string;
  authToken: string;
  encryptionPassphrase?: string; // Optional: for decrypting tasks
}

// Response schemas based on worker types
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
  totalTasks: z.number(),
  activeTasks: z.number(),
  deletedTasks: z.number(),
  lastUpdated: z.number().nullable(),
  oldestTask: z.number().nullable(),
  newestTask: z.number().nullable(),
});

export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type TaskStats = z.infer<typeof taskStatsSchema>;

// Encrypted task blob from API
export const encryptedTaskBlobSchema = z.object({
  id: z.string(),
  encrypted_blob: z.string(),
  nonce: z.string(),
  updated_at: z.number(),
  created_at: z.number(),
});

export type EncryptedTaskBlob = z.infer<typeof encryptedTaskBlobSchema>;

// Decrypted task structure (matches GSD TaskRecord from frontend)
export interface DecryptedTask {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrant: string; // Frontend uses 'quadrant', not 'quadrantId'
  completed: boolean;
  completedAt?: string; // ISO datetime when task was completed
  dueDate?: string; // ISO datetime string, optional (NOT null)
  tags: string[];
  subtasks: Array<{
    id: string;
    title: string; // Frontend uses 'title', not 'text'
    completed: boolean;
  }>;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies: string[];
  createdAt: string; // Frontend expects ISO datetime string
  updatedAt: string; // Frontend expects ISO datetime string
  vectorClock?: Record<string, number>; // For sync conflict resolution
}

// API response types
export interface PullTasksResponse {
  tasks: Array<{
    id: string;
    encryptedBlob: string;
    nonce: string;
    updatedAt: number;
  }>;
}

// Task filters
export interface TaskFilters {
  quadrant?: string;
  completed?: boolean;
  tags?: string[];
}
