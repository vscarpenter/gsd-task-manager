import { apiRequest } from '../api/client.js';
import { syncStatusSchema, statsResponseSchema } from '../types.js';
import type { GsdConfig, SyncStatus, TaskStats } from '../types.js';

/**
 * Get sync status including storage, device count, and conflict information
 * Does not require encryption (metadata only)
 */
export async function getSyncStatus(config: GsdConfig): Promise<SyncStatus> {
  return apiRequest(config, '/api/sync/status', syncStatusSchema);
}

/**
 * Get task statistics using the dedicated /api/stats endpoint
 * Returns metadata without decrypting tasks (more efficient than getDetailedTaskStats)
 */
export async function getTaskStats(config: GsdConfig): Promise<TaskStats> {
  try {
    // Try new /api/stats endpoint for better metadata
    const response = await fetch(`${config.apiBaseUrl}/api/stats`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const json: unknown = await response.json();
      const data = statsResponseSchema.parse(json);
      return {
        totalTasks: data.metadata.totalCount,
        activeTasks: data.metadata.activeCount,
        deletedTasks: data.metadata.deletedCount,
        lastUpdated: data.metadata.newestTaskDate,
        oldestTask: data.metadata.oldestTaskDate,
        newestTask: data.metadata.newestTaskDate,
      };
    }
  } catch (error) {
    // Fall back to old approach if new endpoint not available
    console.error('Failed to fetch from /api/stats, falling back to /api/sync/status');
  }

  // Fallback: use the status endpoint and derive basic stats
  const status = await getSyncStatus(config);
  return {
    totalTasks: status.pendingPushCount + status.pendingPullCount,
    activeTasks: status.pendingPushCount + status.pendingPullCount,
    deletedTasks: 0,
    lastUpdated: status.lastSyncAt,
    oldestTask: null,
    newestTask: null,
  };
}
