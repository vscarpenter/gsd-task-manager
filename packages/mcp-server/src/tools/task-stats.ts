import { apiRequest } from '../api/client.js';
import { initializeEncryption } from '../encryption/manager.js';
import { getCryptoManager } from '../crypto.js';
import { statsResponseSchema } from '../types.js';
import type { GsdConfig, StatsResponse, DecryptedTask } from '../types.js';

/**
 * Detailed task statistics derived from decrypted tasks
 */
export interface DetailedTaskStats {
  // Overall counts
  totalTasks: number;
  activeTasks: number;
  deletedTasks: number;
  completedTasks: number;
  incompleteTasks: number;

  // Quadrant distribution
  quadrantCounts: {
    'urgent-important': number;
    'not-urgent-important': number;
    'urgent-not-important': number;
    'not-urgent-not-important': number;
  };

  // Tag statistics
  tagStats: Array<{
    tag: string;
    count: number;
    completedCount: number;
    completionRate: number;
  }>;

  // Temporal metadata
  oldestTaskDate: number | null;
  newestTaskDate: number | null;
  lastUpdated: number | null;
  storageUsed: number;
}

/**
 * Get detailed task statistics by fetching and decrypting tasks
 * Requires encryption passphrase to be set
 */
export async function getDetailedTaskStats(
  config: GsdConfig
): Promise<DetailedTaskStats> {
  // Fetch encrypted tasks and metadata from new /api/stats endpoint
  const statsResponse = await apiRequest<StatsResponse>(
    config,
    '/api/stats',
    statsResponseSchema
  );

  // Decrypt tasks
  const decryptedTasks = await decryptTasks(statsResponse.tasks, config);

  // Calculate detailed statistics
  return calculateDetailedStats(decryptedTasks, statsResponse.metadata);
}

/**
 * Decrypt all encrypted task blobs
 */
async function decryptTasks(
  encryptedTasks: StatsResponse['tasks'],
  config: GsdConfig
): Promise<DecryptedTask[]> {
  await initializeEncryption(config);
  const cryptoManager = getCryptoManager();
  const decryptedTasks: DecryptedTask[] = [];

  for (const encryptedTask of encryptedTasks) {
    try {
      // Skip deleted tasks
      if (encryptedTask.deletedAt) {
        continue;
      }

      const decryptedJson = await cryptoManager.decrypt(
        encryptedTask.encryptedBlob,
        encryptedTask.nonce
      );
      const task = JSON.parse(decryptedJson) as DecryptedTask;
      decryptedTasks.push(task);
    } catch (error) {
      console.error(`Failed to decrypt task ${encryptedTask.id}:`, error);
      // Skip tasks that fail to decrypt
    }
  }

  return decryptedTasks;
}

/**
 * Calculate detailed statistics from decrypted tasks
 */
function calculateDetailedStats(
  tasks: DecryptedTask[],
  metadata: StatsResponse['metadata']
): DetailedTaskStats {
  // Overall counts
  const totalTasks = metadata.totalCount;
  const activeTasks = metadata.activeCount;
  const deletedTasks = metadata.deletedCount;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const incompleteTasks = tasks.filter((t) => !t.completed).length;

  // Quadrant distribution
  const quadrantCounts = {
    'urgent-important': 0,
    'not-urgent-important': 0,
    'urgent-not-important': 0,
    'not-urgent-not-important': 0,
  };

  for (const task of tasks) {
    const quadrant = task.quadrant as keyof typeof quadrantCounts;
    if (quadrant in quadrantCounts) {
      quadrantCounts[quadrant]++;
    }
  }

  // Tag statistics
  const tagMap = new Map<
    string,
    { count: number; completedCount: number }
  >();

  for (const task of tasks) {
    for (const tag of task.tags || []) {
      const stats = tagMap.get(tag) || { count: 0, completedCount: 0 };
      stats.count++;
      if (task.completed) {
        stats.completedCount++;
      }
      tagMap.set(tag, stats);
    }
  }

  const tagStats = Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      completedCount: stats.completedCount,
      completionRate:
        stats.count > 0
          ? Math.round((stats.completedCount / stats.count) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  // Temporal metadata
  const updatedDates = tasks.map((t) => new Date(t.updatedAt).getTime());
  const lastUpdated = updatedDates.length > 0 ? Math.max(...updatedDates) : null;

  return {
    totalTasks,
    activeTasks,
    deletedTasks,
    completedTasks,
    incompleteTasks,
    quadrantCounts,
    tagStats,
    oldestTaskDate: metadata.oldestTaskDate,
    newestTaskDate: metadata.newestTaskDate,
    lastUpdated,
    storageUsed: metadata.storageUsed,
  };
}
