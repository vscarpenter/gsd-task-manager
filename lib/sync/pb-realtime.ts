/**
 * PocketBase realtime subscription manager
 *
 * Subscribes to the tasks collection via SSE (Server-Sent Events).
 * PocketBase SDK handles reconnection automatically. We filter out
 * "echo" events from the current device to prevent feedback loops.
 */

import { getPocketBase, getCurrentUserId } from './pocketbase-client';
import { applyRemoteChange } from './pb-sync-engine';
import { getPocketBaseRealtimeEnvelope } from './task-mapper';
import { createLogger } from '@/lib/logger';
import type { RecordSubscription, RecordModel } from 'pocketbase';

const logger = createLogger('SYNC_REALTIME');

let unsubscribeFn: (() => void) | null = null;
let currentDeviceId: string | null = null;
let subscriptionPromise: Promise<void> | null = null;
let subscriptionGeneration = 0;

/**
 * Start listening for realtime changes on the tasks collection
 * Applies remote creates/updates/deletes to local IndexedDB.
 */
export async function subscribe(deviceId: string): Promise<void> {
  if (unsubscribeFn && currentDeviceId === deviceId) {
    return;
  }

  if (subscriptionPromise && currentDeviceId === deviceId) {
    return subscriptionPromise;
  }

  const pb = getPocketBase();
  const userId = getCurrentUserId();

  if (!userId) {
    logger.warn('Cannot subscribe: not authenticated');
    return;
  }

  // Invalidate an active or still-starting subscription before replacing it.
  // React development effect replay can call subscribe twice before the first
  // PocketBase promise resolves, so startup is single-flight per device.
  unsubscribe();
  const generation = ++subscriptionGeneration;
  currentDeviceId = deviceId;
  logger.debug('Subscribing to realtime task changes');

  const pending = (async () => {
    const nextUnsubscribe = await pb.collection('tasks').subscribe('*', handleRealtimeEvent);
    if (generation !== subscriptionGeneration || currentDeviceId !== deviceId) {
      nextUnsubscribe();
      return;
    }
    unsubscribeFn = nextUnsubscribe;
    logger.debug('Realtime subscription active');
  })();
  subscriptionPromise = pending;
  try {
    await pending;
  } finally {
    if (subscriptionPromise === pending) subscriptionPromise = null;
  }
}

/**
 * Stop listening for realtime changes
 */
export function unsubscribe(): void {
  subscriptionGeneration++;
  subscriptionPromise = null;
  if (unsubscribeFn) {
    unsubscribeFn();
    unsubscribeFn = null;
    logger.debug('Unsubscribed from realtime');
  }
  currentDeviceId = null;
}


/**
 * Handle a single realtime event from PocketBase SSE
 */
async function handleRealtimeEvent(event: RecordSubscription<RecordModel>): Promise<void> {
  // Validate the record shape before doing anything else. Fails closed on
  // missing / non-string fields — see realtimeRecordShape above.
  const record = getPocketBaseRealtimeEnvelope(event.record);
  if (!record) {
    logger.warn('Skipping malformed realtime event', { action: event.action });
    return;
  }

  // Skip echoes from this device to prevent feedback loops. Require both
  // sides non-empty so an empty/null currentDeviceId (cold-start race)
  // does not accidentally filter every legitimate event as an echo.
  if (record.deviceId && currentDeviceId && record.deviceId === currentDeviceId) {
    logger.debug('Skipping own-device echo', { action: event.action, taskId: record.taskId });
    return;
  }

  // Only process events for the current user.
  const userId = getCurrentUserId();
  if (record.ownerId !== userId) {
    return;
  }

  logger.debug('Realtime event received', {
    action: event.action,
    taskId: record.taskId,
    deviceId: record.deviceId,
  });

  try {
    await applyRemoteChange(event.action as 'create' | 'update' | 'delete', event.record);
  } catch (error) {
    logger.error(
      'Failed to apply realtime change',
      error instanceof Error ? error : new Error(String(error)),
      { action: event.action, taskId: record.taskId }
    );
  }
}
