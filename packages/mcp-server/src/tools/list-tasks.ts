import { initializeEncryption } from '../encryption/manager.js';
import { getCryptoManager } from '../crypto.js';
import { getSupabaseClient, resolveUserId } from '../api/client.js';
import { MAX_TASKS_PER_PULL } from '../constants.js';
import { getTaskCache, generateTaskListCacheKey } from '../cache.js';
import { createMcpLogger } from '../utils/logger.js';
import type {
  GsdConfig,
  DecryptedTask,
  TaskFilters,
} from '../types.js';

const logger = createMcpLogger('LIST_TASKS');

/**
 * List all tasks (decrypted)
 * Requires encryption passphrase to be set
 * Uses in-memory cache to reduce API calls
 */
export async function listTasks(
  config: GsdConfig,
  filters?: TaskFilters
): Promise<DecryptedTask[]> {
  const cache = getTaskCache();
  const cacheKey = generateTaskListCacheKey(filters);

  // Check cache: for filtered requests, try the 'all' cache first and filter locally
  if (filters) {
    const cachedAll = cache.getTaskList('all');
    if (cachedAll) {
      return applyTaskFilters(cachedAll, filters);
    }
  } else {
    const cachedTasks = cache.getTaskList(cacheKey);
    if (cachedTasks) {
      return cachedTasks;
    }
  }

  // Fetch and decrypt tasks
  const encryptedTasks = await fetchEncryptedTasks(config);
  const decryptedTasks = await decryptTaskBatch(encryptedTasks, config);

  // Cache unfiltered results
  if (!filters) {
    cache.setTaskList(cacheKey, decryptedTasks);
  }

  return applyTaskFilters(decryptedTasks, filters);
}

/**
 * Fetch encrypted tasks from Supabase
 */
async function fetchEncryptedTasks(
  config: GsdConfig
): Promise<Array<{ id: string; encryptedBlob: string; nonce: string; updatedAt: string }>> {
  const userId = await resolveUserId(config);
  const supabase = getSupabaseClient(config);

  const { data, error } = await supabase
    .from('encrypted_tasks')
    .select('id, encrypted_blob, nonce, updated_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(MAX_TASKS_PER_PULL);

  if (error) {
    throw new Error(
      `❌ Failed to fetch tasks\n\n` +
        `Database error: ${error.message}\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    encryptedBlob: row.encrypted_blob,
    nonce: row.nonce,
    updatedAt: row.updated_at,
  }));
}

/**
 * Decrypt multiple tasks in batch
 */
async function decryptTaskBatch(
  encryptedTasks: Array<{ id: string; encryptedBlob: string; nonce: string }>,
  config: GsdConfig
): Promise<DecryptedTask[]> {
  await initializeEncryption(config);
  const cryptoManager = getCryptoManager();

  const decryptedTasks: DecryptedTask[] = [];

  for (const encryptedTask of encryptedTasks) {
    try {
      const decryptedJson = await cryptoManager.decrypt(
        encryptedTask.encryptedBlob,
        encryptedTask.nonce
      );
      decryptedTasks.push(JSON.parse(decryptedJson) as DecryptedTask);
    } catch (error) {
      logger.error(`Failed to decrypt task ${encryptedTask.id}`, error instanceof Error ? error : new Error(String(error)));
    }
  }

  return decryptedTasks;
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
