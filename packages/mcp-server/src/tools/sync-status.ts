import { z } from 'zod';
import { apiRequest } from '../api/client.js';
import { syncStatusSchema, taskStatsSchema } from '../types.js';
import type { GsdConfig, SyncStatus, TaskStats } from '../types.js';

/**
 * Get sync status including storage, device count, and conflict information
 * Does not require encryption (metadata only)
 */
export async function getSyncStatus(config: GsdConfig): Promise<SyncStatus> {
  return apiRequest(config, '/api/sync/status', syncStatusSchema);
}

/**
 * Get task statistics without accessing encrypted content
 * Derives stats from sync status metadata
 */
export async function getTaskStats(config: GsdConfig): Promise<TaskStats> {
  // Since the Worker doesn't have a dedicated stats endpoint yet,
  // we'll use the status endpoint and derive stats from it
  // In the future, we can add a dedicated /api/stats endpoint to the Worker

  const status = await getSyncStatus(config);

  // For now, return derived stats from sync status
  // TODO #90: Add dedicated stats endpoint to Worker for more detailed task metadata
  return {
    totalTasks: status.pendingPushCount + status.pendingPullCount,
    activeTasks: status.pendingPushCount + status.pendingPullCount,
    deletedTasks: 0, // Not available from current API
    lastUpdated: status.lastSyncAt,
    oldestTask: null, // Not available from current API
    newestTask: null, // Not available from current API
  };
}
