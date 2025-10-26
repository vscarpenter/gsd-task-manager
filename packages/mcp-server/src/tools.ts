import { z } from 'zod';
import { getCryptoManager } from './crypto.js';

export interface GsdConfig {
  apiBaseUrl: string;
  authToken: string;
  encryptionPassphrase?: string; // Optional: for decrypting tasks
}

// Response schemas based on worker types
const syncStatusSchema = z.object({
  lastSyncAt: z.number().nullable(),
  pendingPushCount: z.number(),
  pendingPullCount: z.number(),
  conflictCount: z.number(),
  deviceCount: z.number(),
  storageUsed: z.number(),
  storageQuota: z.number(),
});

const deviceSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  lastSeenAt: z.number(),
  isActive: z.boolean(),
  isCurrent: z.boolean(),
});

const taskStatsSchema = z.object({
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
const encryptedTaskBlobSchema = z.object({
  id: z.string(),
  encrypted_blob: z.string(),
  nonce: z.string(),
  updated_at: z.number(),
  created_at: z.number(),
});

export type EncryptedTaskBlob = z.infer<typeof encryptedTaskBlobSchema>;

// Decrypted task structure (matches GSD TaskRecord)
export interface DecryptedTask {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrantId: string;
  completed: boolean;
  dueDate: number | null;
  tags: string[];
  subtasks: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Make authenticated API request to GSD Worker
 */
async function apiRequest<T>(
  config: GsdConfig,
  endpoint: string,
  schema: z.ZodType<T>
): Promise<T> {
  const url = `${config.apiBaseUrl}${endpoint}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  const data = await response.json();
  return schema.parse(data);
}

/**
 * Get sync status including storage, device count, and conflict information
 */
export async function getSyncStatus(config: GsdConfig): Promise<SyncStatus> {
  return apiRequest(config, '/api/sync/status', syncStatusSchema);
}

/**
 * List all registered devices for the authenticated user
 */
export async function listDevices(config: GsdConfig): Promise<Device[]> {
  return apiRequest(config, '/api/devices', z.array(deviceSchema));
}

/**
 * Get task statistics without accessing encrypted content
 * This makes a custom query to the database for metadata only
 */
export async function getTaskStats(config: GsdConfig): Promise<TaskStats> {
  // Since the Worker doesn't have a dedicated stats endpoint yet,
  // we'll use the status endpoint and derive stats from it
  // In the future, we can add a dedicated /api/stats endpoint to the Worker

  const status = await getSyncStatus(config);

  // For now, return derived stats from sync status
  // TODO: Add dedicated stats endpoint to Worker for more detailed task metadata
  return {
    totalTasks: status.pendingPushCount + status.pendingPullCount,
    activeTasks: status.pendingPushCount + status.pendingPullCount,
    deletedTasks: 0, // Not available from current API
    lastUpdated: status.lastSyncAt,
    oldestTask: null, // Not available from current API
    newestTask: null, // Not available from current API
  };
}

/**
 * Initialize encryption with user's passphrase
 * Fetches salt from server and derives encryption key
 */
async function initializeEncryption(config: GsdConfig): Promise<void> {
  if (!config.encryptionPassphrase) {
    throw new Error(
      'Encryption passphrase not provided. Set GSD_ENCRYPTION_PASSPHRASE environment variable.'
    );
  }

  const cryptoManager = getCryptoManager();

  if (cryptoManager.isInitialized()) {
    return; // Already initialized
  }

  // Fetch user's encryption salt from server
  // The salt is stored in the user record after OAuth setup
  const response = await fetch(`${config.apiBaseUrl}/api/auth/encryption-salt`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch encryption salt: ${response.status}`);
  }

  const data = (await response.json()) as { encryptionSalt: string };

  if (!data.encryptionSalt) {
    throw new Error(
      'Encryption not set up for this account. Please set up encryption in the GSD app first.'
    );
  }

  // Derive encryption key from passphrase and salt
  await cryptoManager.deriveKey(config.encryptionPassphrase, data.encryptionSalt);
}

/**
 * Decrypt a task blob
 */
async function decryptTask(
  encrypted: EncryptedTaskBlob,
  config: GsdConfig
): Promise<DecryptedTask> {
  await initializeEncryption(config);

  const cryptoManager = getCryptoManager();
  const decryptedJson = await cryptoManager.decrypt(
    encrypted.encrypted_blob,
    encrypted.nonce
  );

  const task = JSON.parse(decryptedJson) as DecryptedTask;
  return task;
}

/**
 * List all tasks (decrypted)
 * Requires encryption passphrase to be set
 */
export async function listTasks(
  config: GsdConfig,
  filters?: {
    quadrant?: string;
    completed?: boolean;
    tags?: string[];
  }
): Promise<DecryptedTask[]> {
  // First, we need to call the pull endpoint to get encrypted tasks
  const response = await fetch(`${config.apiBaseUrl}/api/sync/pull`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: '9Sc6Q_f_mj_pjhRkDM-vZg', // Use actual device ID from JWT
      lastVectorClock: {}, // Empty clock to get all tasks
      sinceTimestamp: 1, // Start from epoch + 1ms to get all tasks
      limit: 100, // Max allowed by Worker schema
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.status}`);
  }

  const data = (await response.json()) as {
    tasks: Array<{
      id: string;
      encryptedBlob: string;
      nonce: string;
      updatedAt: number;
    }>;
  };

  // Decrypt all tasks
  const decryptedTasks: DecryptedTask[] = [];

  for (const encryptedTask of data.tasks) {
    try {
      const task = await decryptTask(
        {
          id: encryptedTask.id,
          encrypted_blob: encryptedTask.encryptedBlob,
          nonce: encryptedTask.nonce,
          updated_at: encryptedTask.updatedAt,
          created_at: encryptedTask.updatedAt, // Not available in pull response
        },
        config
      );

      // Apply filters if provided
      if (filters) {
        if (filters.quadrant && task.quadrantId !== filters.quadrant) continue;
        if (filters.completed !== undefined && task.completed !== filters.completed)
          continue;
        if (
          filters.tags &&
          filters.tags.length > 0 &&
          !filters.tags.some((tag) => task.tags.includes(tag))
        )
          continue;
      }

      decryptedTasks.push(task);
    } catch (error) {
      console.error(`Failed to decrypt task ${encryptedTask.id}:`, error);
      // Skip tasks that fail to decrypt
    }
  }

  return decryptedTasks;
}

/**
 * Get a single task by ID (decrypted)
 */
export async function getTask(config: GsdConfig, taskId: string): Promise<DecryptedTask> {
  const tasks = await listTasks(config);
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return task;
}

/**
 * Search tasks by title, description, or tags
 */
export async function searchTasks(
  config: GsdConfig,
  query: string
): Promise<DecryptedTask[]> {
  const tasks = await listTasks(config);
  const queryLower = query.toLowerCase();

  return tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(queryLower) ||
      task.description.toLowerCase().includes(queryLower) ||
      task.tags.some((tag) => tag.toLowerCase().includes(queryLower)) ||
      task.subtasks.some((subtask) => subtask.text.toLowerCase().includes(queryLower))
  );
}
