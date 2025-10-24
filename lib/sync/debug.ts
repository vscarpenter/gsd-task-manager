/**
 * Sync debugging utilities
 * These functions are exposed to window.syncDebug for manual testing
 */

import { getSyncConfig, resetAndFullSync } from './config';
import { getSyncQueue } from './queue';
import { getSyncEngine } from './engine';
import { getDb } from '@/lib/db';

export interface SyncDebugTools {
  /**
   * Get current sync state (config, queue, tasks)
   */
  getState: () => Promise<{
    config: any;
    queue: any[];
    taskCount: number;
    syncQueueCount: number;
  }>;

  /**
   * Reset sync state and pull all tasks from server
   * WARNING: Clears all local tasks and pending operations
   */
  fullReset: () => Promise<void>;

  /**
   * Manually trigger a sync operation
   */
  sync: () => Promise<any>;

  /**
   * View pending sync queue
   */
  viewQueue: () => Promise<any[]>;

  /**
   * Clear sync queue without syncing
   */
  clearQueue: () => Promise<void>;
}

export function createSyncDebugTools(): SyncDebugTools {
  return {
    getState: async () => {
      const config = await getSyncConfig();
      const queue = getSyncQueue();
      const pending = await queue.getPending();
      const db = getDb();
      const taskCount = await db.tasks.count();
      const syncQueueCount = await db.syncQueue.count();

      return {
        config: {
          enabled: config?.enabled,
          email: config?.email,
          deviceId: config?.deviceId,
          lastSyncAt: config?.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
          vectorClock: config?.vectorClock,
          serverUrl: config?.serverUrl,
        },
        queue: pending,
        taskCount,
        syncQueueCount,
      };
    },

    fullReset: async () => {
      console.log('[SYNC DEBUG] ⚠️  WARNING: This will clear all local tasks!');
      console.log('[SYNC DEBUG] Make sure tasks are synced to server before proceeding.');

      await resetAndFullSync();

      console.log('[SYNC DEBUG] ✅ Reset complete. Now call syncDebug.sync() to pull from server.');
    },

    sync: async () => {
      const engine = getSyncEngine();
      const result = await engine.sync();
      console.log('[SYNC DEBUG] Sync result:', result);
      return result;
    },

    viewQueue: async () => {
      const queue = getSyncQueue();
      const pending = await queue.getPending();
      console.log('[SYNC DEBUG] Pending sync operations:', pending);
      return pending;
    },

    clearQueue: async () => {
      const db = getDb();
      const count = await db.syncQueue.count();
      await db.syncQueue.clear();
      console.log(`[SYNC DEBUG] Cleared ${count} pending operations`);
    },
  };
}

/**
 * Install debug tools on window object (client-side only)
 */
export function installSyncDebugTools() {
  if (typeof window !== 'undefined') {
    (window as any).syncDebug = createSyncDebugTools();
    console.log('[SYNC DEBUG] Debug tools installed on window.syncDebug');
    console.log('[SYNC DEBUG] Available commands:');
    console.log('  - syncDebug.getState() - View current sync state');
    console.log('  - syncDebug.viewQueue() - View pending operations');
    console.log('  - syncDebug.sync() - Manually trigger sync');
    console.log('  - syncDebug.clearQueue() - Clear pending operations');
    console.log('  - syncDebug.fullReset() - Reset and pull all from server (DESTRUCTIVE)');
  }
}
