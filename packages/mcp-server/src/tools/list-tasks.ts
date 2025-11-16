import { getDeviceIdFromToken } from '../jwt.js';
import { initializeEncryption } from '../encryption/manager.js';
import { getCryptoManager } from '../crypto.js';
import { MAX_TASKS_PER_PULL } from '../constants.js';
import type {
  GsdConfig,
  DecryptedTask,
  TaskFilters,
  EncryptedTaskBlob,
  PullTasksResponse,
} from '../types.js';

/**
 * List all tasks (decrypted)
 * Requires encryption passphrase to be set
 */
export async function listTasks(
  config: GsdConfig,
  filters?: TaskFilters
): Promise<DecryptedTask[]> {
  const deviceId = extractDeviceId(config);
  const encryptedTasks = await fetchEncryptedTasks(config, deviceId);
  const decryptedTasks = await decryptTaskBatch(encryptedTasks, config);
  return applyTaskFilters(decryptedTasks, filters);
}

/**
 * Extract device ID from JWT token
 */
function extractDeviceId(config: GsdConfig): string {
  try {
    return getDeviceIdFromToken(config.authToken);
  } catch (error) {
    throw new Error(
      `❌ Failed to parse device ID from auth token\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Your token may be invalid or corrupted.\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }
}

/**
 * Fetch encrypted tasks from Worker API
 */
async function fetchEncryptedTasks(
  config: GsdConfig,
  deviceId: string
): Promise<PullTasksResponse['tasks']> {
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
        limit: MAX_TASKS_PER_PULL,
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

  const data = (await response.json()) as PullTasksResponse;
  return data.tasks;
}

/**
 * Decrypt multiple tasks in batch
 */
async function decryptTaskBatch(
  encryptedTasks: PullTasksResponse['tasks'],
  config: GsdConfig
): Promise<DecryptedTask[]> {
  const decryptedTasks: DecryptedTask[] = [];

  for (const encryptedTask of encryptedTasks) {
    try {
      const task = await decryptSingleTask(encryptedTask, config);
      decryptedTasks.push(task);
    } catch (error) {
      console.error(`Failed to decrypt task ${encryptedTask.id}:`, error);
      // Skip tasks that fail to decrypt
    }
  }

  return decryptedTasks;
}

/**
 * Decrypt a single task blob
 */
async function decryptSingleTask(
  encryptedTask: PullTasksResponse['tasks'][number],
  config: GsdConfig
): Promise<DecryptedTask> {
  await initializeEncryption(config);

  const cryptoManager = getCryptoManager();
  const decryptedJson = await cryptoManager.decrypt(
    encryptedTask.encryptedBlob,
    encryptedTask.nonce
  );

  return JSON.parse(decryptedJson) as DecryptedTask;
}

/**
 * Apply filters to decrypted tasks
 */
function applyTaskFilters(
  tasks: DecryptedTask[],
  filters?: TaskFilters
): DecryptedTask[] {
  if (!filters) return tasks;

  return tasks.filter((task) => {
    if (filters.quadrant && task.quadrant !== filters.quadrant) {
      return false;
    }

    if (filters.completed !== undefined && task.completed !== filters.completed) {
      return false;
    }

    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !filters.tags.some((tag) => task.tags.includes(tag))
    ) {
      return false;
    }

    return true;
  });
}
