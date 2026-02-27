/**
 * Supabase sync client
 * Wraps Supabase SDK for encrypted task sync operations.
 * All task data is encrypted client-side before transmission.
 */

import { getSupabaseClient } from '@/lib/supabase';
import type { EncryptedTaskRow, DeviceRow } from './types';

/** Push an encrypted task (upsert with optimistic version locking) */
export async function pushEncryptedTask(task: {
  id: string;
  userId: string;
  encryptedBlob: string;
  nonce: string;
  checksum: string;
  deviceId: string;
  expectedVersion?: number;
}): Promise<{ success: boolean; newVersion: number; conflict: boolean }> {
  const supabase = getSupabaseClient();

  // Check current version for optimistic locking
  const { data: existing } = await supabase
    .from('encrypted_tasks')
    .select('version')
    .eq('id', task.id)
    .eq('user_id', task.userId)
    .maybeSingle();

  const currentVersion = existing?.version ?? 0;

  // If caller expected a specific version and it doesn't match, conflict
  if (task.expectedVersion !== undefined && existing && currentVersion !== task.expectedVersion) {
    return { success: false, newVersion: currentVersion, conflict: true };
  }

  const newVersion = currentVersion + 1;

  const { error } = await supabase
    .from('encrypted_tasks')
    .upsert({
      id: task.id,
      user_id: task.userId,
      encrypted_blob: task.encryptedBlob,
      nonce: task.nonce,
      version: newVersion,
      checksum: task.checksum,
      last_modified_device: task.deviceId,
      deleted_at: null, // Clear any soft-delete on re-push
    }, {
      onConflict: 'id,user_id',
    });

  if (error) throw new Error(`Failed to push task ${task.id}: ${error.message}`);

  return { success: true, newVersion, conflict: false };
}

/** Soft-delete a task */
export async function softDeleteTask(
  taskId: string,
  userId: string,
  deviceId: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('encrypted_tasks')
    .update({
      deleted_at: new Date().toISOString(),
      last_modified_device: deviceId,
    })
    .eq('id', taskId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to delete task ${taskId}: ${error.message}`);
}

/** Pull tasks updated since a given timestamp */
export async function pullTasksSince(
  userId: string,
  sinceTimestamp: string | null
): Promise<EncryptedTaskRow[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('encrypted_tasks')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true });

  if (sinceTimestamp) {
    query = query.gt('updated_at', sinceTimestamp);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to pull tasks: ${error.message}`);
  return data ?? [];
}

/** Pull IDs of tasks soft-deleted since a given timestamp */
export async function pullDeletedTaskIds(
  userId: string,
  sinceTimestamp: string | null
): Promise<string[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('encrypted_tasks')
    .select('id')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);

  if (sinceTimestamp) {
    query = query.gt('updated_at', sinceTimestamp);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to pull deleted task IDs: ${error.message}`);
  return (data ?? []).map(row => row.id);
}

/** Get or update the user's encryption salt from their profile */
export async function getEncryptionSalt(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('encryption_salt')
    .eq('id', userId)
    .single();

  if (error) throw new Error(`Failed to get encryption salt: ${error.message}`);
  return data?.encryption_salt ?? null;
}

/** Store the user's encryption salt in their profile */
export async function setEncryptionSalt(userId: string, salt: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('profiles')
    .update({ encryption_salt: salt })
    .eq('id', userId);

  if (error) throw new Error(`Failed to set encryption salt: ${error.message}`);
}

/** Register or update a device */
export async function upsertDevice(
  deviceId: string,
  userId: string,
  deviceName: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('devices')
    .upsert({
      id: deviceId,
      user_id: userId,
      device_name: deviceName,
      last_seen_at: new Date().toISOString(),
    }, {
      onConflict: 'id,user_id',
    });

  if (error) throw new Error(`Failed to upsert device: ${error.message}`);
}

/** List all devices for a user */
export async function listDevices(userId: string): Promise<DeviceRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });

  if (error) throw new Error(`Failed to list devices: ${error.message}`);
  return data ?? [];
}

/** Remove a device */
export async function removeDevice(deviceId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to remove device: ${error.message}`);
}

/** Update sync metadata for the current device */
export async function updateSyncMetadataRemote(
  userId: string,
  deviceId: string,
  status: 'idle' | 'syncing' | 'error'
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('sync_metadata')
    .upsert({
      user_id: userId,
      device_id: deviceId,
      last_sync_at: new Date().toISOString(),
      sync_status: status,
    }, {
      onConflict: 'user_id,device_id',
    });

  if (error) throw new Error(`Failed to update sync metadata: ${error.message}`);
}
