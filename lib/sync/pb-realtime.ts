/**
 * PocketBase realtime subscription manager
 *
 * Subscribes to the tasks collection via SSE (Server-Sent Events).
 * PocketBase SDK handles reconnection automatically. We filter out
 * "echo" events from the current device to prevent feedback loops.
 */

import { z } from 'zod';
import { getPocketBase, getCurrentUserId } from './pocketbase-client';
import { applyRemoteChange } from './pb-sync-engine';
import { createLogger } from '@/lib/logger';
import type { RecordSubscription, RecordModel } from 'pocketbase';

const logger = createLogger('SYNC_REALTIME');

let unsubscribeFn: (() => void) | null = null;
let currentDeviceId: string | null = null;

/**
 * Minimal shape that every inbound realtime record must satisfy before we
 * route it to the sync engine. PocketBase responses are normally well-typed,
 * but a compromised or misbehaving server could push something weird (an
 * object with a `toString` that fakes the current device id, for example).
 * Failing closed on type-mismatch is safer than letting unexpected shapes
 * flow into IndexedDB.
 */
const realtimeRecordShape = z.object({
  device_id: z.string(),
  task_id: z.string(),
  owner: z.string(),
});

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
 * Handle a single realtime event from PocketBase SSE
 */
async function handleRealtimeEvent(event: RecordSubscription<RecordModel>): Promise<void> {
  // Validate the record shape before doing anything else. Fails closed on
  // missing / non-string fields — see realtimeRecordShape above.
  const parsed = realtimeRecordShape.safeParse(event.record);
  if (!parsed.success) {
    logger.warn('Skipping malformed realtime event', {
      action: event.action,
      issues: parsed.error.issues.map((i) => i.path.join('.')).join(','),
    });
    return;
  }
  const record = parsed.data;

  // Skip echoes from this device to prevent feedback loops. Require both
  // sides non-empty so an empty/null currentDeviceId (cold-start race)
  // does not accidentally filter every legitimate event as an echo.
  if (record.device_id && currentDeviceId && record.device_id === currentDeviceId) {
    logger.debug('Skipping own-device echo', { action: event.action, taskId: record.task_id });
    return;
  }

  // Only process events for the current user.
  const userId = getCurrentUserId();
  if (record.owner !== userId) {
    return;
  }

  logger.debug('Realtime event received', {
    action: event.action,
    taskId: record.task_id,
    deviceId: record.device_id,
  });

  try {
    await applyRemoteChange(event.action as 'create' | 'update' | 'delete', event.record);
  } catch (error) {
    logger.error(
      'Failed to apply realtime change',
      error instanceof Error ? error : new Error(String(error)),
      { action: event.action, taskId: record.task_id }
    );
  }
}
