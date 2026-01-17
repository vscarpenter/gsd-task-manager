/**
 * Sync debugging utilities
 * Run these in browser console to diagnose sync issues
 */

import { getDb } from '@/lib/db';
import { getSyncQueue } from './queue';

export async function debugSyncQueue() {
  const db = getDb();
  const queue = getSyncQueue();
  
  console.log('=== SYNC QUEUE DEBUG ===');
  
  // Get all pending operations
  const pending = await queue.getPending();
  console.log(`Total pending operations: ${pending.length}`);
  
  if (pending.length > 0) {
    console.log('\nPending operations:');
    for (const op of pending) {
      console.log({
        id: op.id,
        taskId: op.taskId,
        operation: op.operation,
        timestamp: new Date(op.timestamp).toISOString(),
        retryCount: op.retryCount,
        consolidatedFrom: op.consolidatedFrom?.length || 0,
        hasPayload: !!op.payload,
      });
    }
    
    // Check for duplicate taskIds
    const taskIds = pending.map(op => op.taskId);
    const duplicates = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      console.warn('\n⚠️  DUPLICATE TASK IDS IN QUEUE:', [...new Set(duplicates)]);
    }
  }
  
  // Get sync config
  const configData = await db.syncMetadata.get('sync_config');
  const config = configData && 'enabled' in configData ? configData : null;
  console.log('\n=== SYNC CONFIG ===');
  console.log({
    enabled: config?.enabled,
    lastSyncAt: config?.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
    consecutiveFailures: config?.consecutiveFailures,
    nextRetryAt: config?.nextRetryAt ? new Date(config.nextRetryAt).toISOString() : null,
    vectorClock: config?.vectorClock,
  });
  
  // Get all tasks
  const tasks = await db.tasks.toArray();
  console.log('\n=== TASKS ===');
  console.log(`Total tasks: ${tasks.length}`);
  
  return {
    pendingOps: pending,
    config,
    tasks,
  };
}

export async function clearStuckOperations() {
  const queue = getSyncQueue();
  const pending = await queue.getPending();
  
  console.log(`Found ${pending.length} pending operations`);
  
  if (pending.length === 0) {
    console.log('No operations to clear');
    return;
  }
  
  const confirm = window.confirm(
    `Are you sure you want to clear ${pending.length} pending operations? This cannot be undone.`
  );
  
  if (confirm) {
    await queue.clear();
    console.log('✓ Queue cleared');
  } else {
    console.log('Cancelled');
  }
}

/**
 * Install debug tools on window object for console access
 */
export function installSyncDebugTools() {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).debugSyncQueue = debugSyncQueue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).clearStuckOperations = clearStuckOperations;
    console.log('[SYNC DEBUG] Debug tools installed. Available functions:');
    console.log('  - debugSyncQueue()');
    console.log('  - clearStuckOperations()');
  }
}

// Auto-install in browser environment
if (typeof window !== 'undefined') {
  installSyncDebugTools();
}
