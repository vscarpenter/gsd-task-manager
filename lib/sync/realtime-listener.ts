/**
 * Supabase Realtime listener for instant cross-device sync
 * Subscribes to encrypted_tasks changes and merges into local IndexedDB.
 */

"use client";

import { getSupabaseClient } from '@/lib/supabase';
import { getCryptoManager } from '@/lib/sync/crypto';
import { getDb } from '@/lib/db';
import { taskRecordSchema } from '@/lib/schema';
import { createLogger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { EncryptedTaskRow } from './types';

const logger = createLogger('SYNC_REALTIME');

export type RealtimeConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

type ConnectionStateListener = (state: RealtimeConnectionState) => void;

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let currentDeviceId: string | null = null;
let connectionState: RealtimeConnectionState = 'disconnected';
const stateListeners = new Set<ConnectionStateListener>();

function setConnectionState(state: RealtimeConnectionState): void {
  connectionState = state;
  for (const listener of stateListeners) {
    listener(state);
  }
}

/** Subscribe to connection state changes */
export function onConnectionStateChange(listener: ConnectionStateListener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** Get current connection state */
export function getConnectionState(): RealtimeConnectionState {
  return connectionState;
}

/** Start listening for real-time task changes */
export function startRealtimeListener(userId: string, deviceId: string): void {
  // Already listening for this user
  if (channel && currentUserId === userId) return;

  // Clean up existing subscription
  stopRealtimeListener();

  currentUserId = userId;
  currentDeviceId = deviceId;
  setConnectionState('connecting');

  const supabase = getSupabaseClient();

  channel = supabase
    .channel(`sync:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'encrypted_tasks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => handleTaskChange(payload.new as EncryptedTaskRow)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'encrypted_tasks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => handleTaskChange(payload.new as EncryptedTaskRow)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionState('connected');
        logger.info('Realtime subscription active');
      } else if (status === 'CLOSED') {
        setConnectionState('disconnected');
        logger.info('Realtime subscription closed');
      } else if (status === 'CHANNEL_ERROR') {
        setConnectionState('reconnecting');
        logger.warn('Realtime channel error, will attempt reconnect');
      }
    });
}

/** Stop listening for real-time changes */
export function stopRealtimeListener(): void {
  if (channel) {
    const supabase = getSupabaseClient();
    supabase.removeChannel(channel);
    channel = null;
  }
  currentUserId = null;
  currentDeviceId = null;
  setConnectionState('disconnected');
}

/** Handle an incoming task change from Realtime */
async function handleTaskChange(row: EncryptedTaskRow): Promise<void> {
  try {
    // Skip changes made by this device to avoid infinite loops
    if (row.last_modified_device === currentDeviceId) return;

    // Handle soft-deletes
    if (row.deleted_at) {
      const db = getDb();
      await db.tasks.delete(row.id);
      logger.info(`Realtime: deleted task ${row.id}`);
      return;
    }

    // Decrypt the task
    const crypto = getCryptoManager();
    if (!crypto.isInitialized()) {
      logger.warn('Realtime: crypto not initialized, skipping change');
      return;
    }

    const decryptedJson = await crypto.decrypt(row.encrypted_blob, row.nonce);
    const task = taskRecordSchema.parse(JSON.parse(decryptedJson));

    // Apply LWW — only update if remote is newer
    const db = getDb();
    const existing = await db.tasks.get(row.id);

    if (existing) {
      const remoteTime = new Date(row.updated_at).getTime();
      const localTime = new Date(existing.updatedAt).getTime();
      if (remoteTime < localTime) {
        logger.info(`Realtime: skipping older remote version of task ${row.id}`);
        return;
      }
    }

    await db.tasks.put(task);
    logger.info(`Realtime: merged task ${row.id}`);
  } catch (err) {
    logger.error(`Realtime: failed to process change for task ${row.id}`, err as Error);
  }
}
