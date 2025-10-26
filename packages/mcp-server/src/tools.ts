import { z } from 'zod';
import { getCryptoManager } from './crypto.js';
import { getDeviceIdFromToken } from './jwt.js';

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

// Decrypted task structure (matches GSD TaskRecord from frontend)
export interface DecryptedTask {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrant: string; // Frontend uses 'quadrant', not 'quadrantId'
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
  createdAt: string; // Frontend expects ISO datetime string
  updatedAt: string; // Frontend expects ISO datetime string
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

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `❌ Failed to connect to ${config.apiBaseUrl}\n\n` +
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Please check:\n` +
        `  1. Your internet connection\n` +
        `  2. GSD_API_URL is correct (${config.apiBaseUrl})\n` +
        `  3. The Worker is deployed and accessible\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();

    // Enhanced error messages based on status code
    if (response.status === 401) {
      throw new Error(
        `❌ Authentication failed (401 Unauthorized)\n\n` +
          `Your auth token has expired or is invalid.\n\n` +
          `To fix:\n` +
          `  1. Visit ${config.apiBaseUrl}\n` +
          `  2. Complete OAuth login\n` +
          `  3. Copy new token from DevTools → Application → Local Storage → gsd_auth_token\n` +
          `  4. Update GSD_AUTH_TOKEN in Claude Desktop config\n` +
          `  5. Restart Claude Desktop\n\n` +
          `Run: npx gsd-mcp-server --setup`
      );
    } else if (response.status === 404) {
      throw new Error(
        `❌ Endpoint not found (404 Not Found)\n\n` +
          `The API endpoint ${endpoint} does not exist.\n\n` +
          `Please check:\n` +
          `  1. GSD_API_URL is correct (${config.apiBaseUrl})\n` +
          `  2. Your Worker is deployed with the latest version\n` +
          `  3. You're using a compatible MCP server version\n\n` +
          `Run: npx gsd-mcp-server --validate`
      );
    } else if (response.status === 403) {
      throw new Error(
        `❌ Access forbidden (403 Forbidden)\n\n` +
          `You don't have permission to access this resource.\n\n` +
          `This could mean:\n` +
          `  1. Your token is for a different user/account\n` +
          `  2. The resource has been revoked\n` +
          `  3. CORS or access policy restrictions\n\n` +
          `Try logging in again: npx gsd-mcp-server --setup`
      );
    } else if (response.status >= 500) {
      throw new Error(
        `❌ Server error (${response.status} ${response.statusText})\n\n` +
          `The GSD Worker encountered an internal error.\n\n` +
          `Error details: ${errorText}\n\n` +
          `Please try again in a few moments. If the issue persists, check:\n` +
          `  - Worker logs in Cloudflare dashboard\n` +
          `  - GitHub issues: https://github.com/vscarpenter/gsd-taskmanager/issues`
      );
    } else {
      throw new Error(
        `❌ API request failed (${response.status} ${response.statusText})\n\n` +
          `Error details: ${errorText}\n\n` +
          `Run: npx gsd-mcp-server --validate`
      );
    }
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
      `❌ Encryption passphrase not provided\n\n` +
        `This tool requires decrypted task access.\n\n` +
        `To enable:\n` +
        `  1. Set GSD_ENCRYPTION_PASSPHRASE in Claude Desktop config\n` +
        `  2. Use the same passphrase you set up in the GSD app\n` +
        `  3. Restart Claude Desktop\n\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }

  const cryptoManager = getCryptoManager();

  if (cryptoManager.isInitialized()) {
    return; // Already initialized
  }

  // Fetch user's encryption salt from server
  // The salt is stored in the user record after OAuth setup
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/api/auth/encryption-salt`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `❌ Failed to fetch encryption salt\n\n` +
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        `❌ Authentication failed while fetching encryption salt\n\n` +
          `Your token has expired. Run: npx gsd-mcp-server --setup`
      );
    }
    throw new Error(
      `❌ Failed to fetch encryption salt (${response.status})\n\n` +
        `The Worker API endpoint may not support encryption.\n` +
        `Ensure you're using Worker v0.2.0+\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  const data = (await response.json()) as { encryptionSalt: string };

  if (!data.encryptionSalt) {
    throw new Error(
      `❌ Encryption not set up for this account\n\n` +
        `Please set up encryption in the GSD app first:\n` +
        `  1. Visit ${config.apiBaseUrl}\n` +
        `  2. Go to Settings → Sync\n` +
        `  3. Set an encryption passphrase\n` +
        `  4. Complete initial sync\n\n` +
        `Then run: npx gsd-mcp-server --setup`
    );
  }

  // Derive encryption key from passphrase and salt
  try {
    await cryptoManager.deriveKey(config.encryptionPassphrase, data.encryptionSalt);
  } catch (error) {
    throw new Error(
      `❌ Failed to derive encryption key\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Your passphrase or salt may be corrupted.\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }
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
  // Extract device ID from JWT token
  let deviceId: string;
  try {
    deviceId = getDeviceIdFromToken(config.authToken);
  } catch (error) {
    throw new Error(
      `❌ Failed to parse device ID from auth token\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Your token may be invalid or corrupted.\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }

  // First, we need to call the pull endpoint to get encrypted tasks
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/api/sync/pull`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        lastVectorClock: {}, // Empty clock to get all tasks
        sinceTimestamp: 1, // Start from epoch + 1ms to get all tasks
        limit: 100, // Max allowed by Worker schema
      }),
    });
  } catch (error) {
    throw new Error(
      `❌ Failed to fetch tasks\n\n` +
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

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
        if (filters.quadrant && task.quadrant !== filters.quadrant) continue;
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
