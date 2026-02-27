import { getSupabaseClient, resolveUserId } from '../api/client.js';
import type { GsdConfig, SyncStatus, TaskStats } from '../types.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('SYNC_STATUS');

/**
 * Get sync status by querying Supabase tables directly
 * Does not require encryption (metadata only)
 */
export async function getSyncStatus(config: GsdConfig): Promise<SyncStatus> {
  const userId = await resolveUserId(config);
  const supabase = getSupabaseClient(config);

  // Count devices
  const { count: deviceCount } = await supabase
    .from('devices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Count active tasks
  const { count: activeCount } = await supabase
    .from('encrypted_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);

  // Get last sync timestamp from sync_metadata
  const { data: syncMeta } = await supabase
    .from('sync_metadata')
    .select('last_sync_at')
    .eq('user_id', userId)
    .order('last_sync_at', { ascending: false })
    .limit(1)
    .single();

  const lastSyncAt = syncMeta?.last_sync_at
    ? new Date(syncMeta.last_sync_at).getTime()
    : null;

  return {
    lastSyncAt,
    pendingPushCount: 0, // MCP server doesn't track push/pull queues
    pendingPullCount: 0,
    conflictCount: 0,
    deviceCount: deviceCount ?? 0,
    storageUsed: activeCount ?? 0,
    storageQuota: -1, // No quota with Supabase
  };
}

/**
 * Get task statistics by querying Supabase tables directly
 * More efficient than decrypting — just counts and timestamps
 */
export async function getTaskStats(config: GsdConfig): Promise<TaskStats> {
  const userId = await resolveUserId(config);
  const supabase = getSupabaseClient(config);

  try {
    // Count active tasks
    const { count: activeCount } = await supabase
      .from('encrypted_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    // Count deleted tasks
    const { count: deletedCount } = await supabase
      .from('encrypted_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('deleted_at', 'is', null);

    // Get oldest task
    const { data: oldest } = await supabase
      .from('encrypted_tasks')
      .select('created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    // Get newest task
    const { data: newest } = await supabase
      .from('encrypted_tasks')
      .select('updated_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    const total = (activeCount ?? 0) + (deletedCount ?? 0);

    return {
      totalTasks: total,
      activeTasks: activeCount ?? 0,
      deletedTasks: deletedCount ?? 0,
      lastUpdated: newest?.updated_at ? new Date(newest.updated_at).getTime() : null,
      oldestTask: oldest?.created_at ? new Date(oldest.created_at).getTime() : null,
      newestTask: newest?.updated_at ? new Date(newest.updated_at).getTime() : null,
    };
  } catch (error) {
    logger.warn('Failed to fetch task stats', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      totalTasks: null,
      activeTasks: null,
      deletedTasks: null,
      lastUpdated: null,
      oldestTask: null,
      newestTask: null,
    };
  }
}
