/**
 * PocketBase realtime subscription manager
 *
 * Subscribes to the tasks collection via SSE (Server-Sent Events).
 * PocketBase SDK handles reconnection automatically. We filter out
 * "echo" events from the current device to prevent feedback loops.
 */

import { getPocketBase, getCurrentUserId } from './pocketbase-client';
import { applyRemoteChange } from './pb-sync-engine';
import { createLogger } from '@/lib/logger';
import type { RecordSubscription, RecordModel } from 'pocketbase';

const logger = createLogger('SYNC_REALTIME');

let unsubscribeFn: (() => void) | null = null;
let currentDeviceId: string | null = null;

/**
 * Start listening for realtime changes on the tasks collection
 * Applies remote creates/updates/deletes to local IndexedDB.
 */
export async function subscribe(deviceId: string): Promise<void> {
  // Prevent double subscription
  if (unsubscribeFn) {
    logger.warn('Already subscribed to realtime, unsubscribing first');
    unsubscribe();
  }

  currentDeviceId = deviceId;
  const pb = getPocketBase();
  const userId = getCurrentUserId();

  if (!userId) {
    logger.warn('Cannot subscribe: not authenticated');
    return;
  }

  logger.info('Subscribing to realtime task changes');

  unsubscribeFn = await pb.collection('tasks').subscribe('*', handleRealtimeEvent);

  logger.info('Realtime subscription active');
}

/**
 * Stop listening for realtime changes
 */
export function unsubscribe(): void {
  if (unsubscribeFn) {
    unsubscribeFn();
    unsubscribeFn = null;
    currentDeviceId = null;
    logger.info('Unsubscribed from realtime');
  }
}

/**
 * Check if realtime subscription is active
 */
export function isSubscribed(): boolean {
  return unsubscribeFn !== null;
}

/**
 * Handle a single realtime event from PocketBase SSE
 */
async function handleRealtimeEvent(event: RecordSubscription<RecordModel>): Promise<void> {
  const record = event.record;

  // Skip echoes from this device to prevent feedback loops
  if (record['device_id'] === currentDeviceId) {
    logger.debug('Skipping own-device echo', { action: event.action, taskId: record['task_id'] });
    return;
  }

  // Only process events for the current user
  const userId = getCurrentUserId();
  if (record['owner'] !== userId) {
    return;
  }

  logger.debug('Realtime event received', {
    action: event.action,
    taskId: record['task_id'],
    deviceId: record['device_id'],
  });

  try {
    await applyRemoteChange(event.action as 'create' | 'update' | 'delete', record);
  } catch (error) {
    logger.error(
      'Failed to apply realtime change',
      error instanceof Error ? error : new Error(String(error)),
      { action: event.action, taskId: record['task_id'] }
    );
  }
}
