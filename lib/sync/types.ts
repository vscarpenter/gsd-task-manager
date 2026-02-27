/**
 * Sync-specific types (Supabase backend)
 */

import type { TaskRecord } from '@/lib/types';

// Sync configuration stored in IndexedDB
export interface SyncConfig {
  key: 'sync_config';
  enabled: boolean;
  userId: string | null;
  deviceId: string;
  deviceName: string;
  email: string | null;
  lastSyncAt: number | null;
  conflictStrategy: 'last_write_wins' | 'manual';
  provider?: string | null;
  // Retry tracking fields
  consecutiveFailures: number;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  nextRetryAt: number | null;
  // Auto-sync configuration
  autoSyncEnabled?: boolean;
  autoSyncIntervalMinutes?: number;
}

// Background sync configuration
export interface BackgroundSyncConfig {
  enabled: boolean;
  intervalMinutes: number;
  syncOnFocus: boolean;
  syncOnOnline: boolean;
  debounceAfterChangeMs: number;
}

// Sync queue item (pending operations)
export interface SyncQueueItem {
  id: string;
  taskId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: number;
  retryCount: number;
  payload: TaskRecord | null;
  consolidatedFrom?: string[]; // IDs of operations merged into this one
  lastAttemptAt?: number; // Timestamp of last sync attempt
}

// Device info
export interface DeviceInfo {
  key: 'device_info';
  deviceId: string;
  deviceName: string;
  createdAt: string;
}

// Encryption config
export interface EncryptionConfig {
  key: 'encryption_salt';
  value: {
    salt: number[];
  };
}

// Encrypted task row as stored in Supabase
export interface EncryptedTaskRow {
  id: string;
  user_id: string;
  encrypted_blob: string;
  nonce: string;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  last_modified_device: string | null;
  checksum: string;
}

// Conflict information
export interface ConflictInfo {
  taskId: string;
  local: TaskRecord;
  remote: TaskRecord;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
}

// Sync result
export interface SyncResult {
  status: 'success' | 'error' | 'conflict' | 'already_running';
  pushedCount?: number;
  pulledCount?: number;
  conflictsResolved?: number;
  conflicts?: ConflictInfo[];
  timestamp?: number;
  error?: string;
}

// Supabase sync status (replaces SyncStatusResponse)
export interface SyncStatusInfo {
  lastSyncAt: number | null;
  pendingPushCount: number;
  deviceCount: number;
}

// Device row from Supabase
export interface DeviceRow {
  id: string;
  user_id: string;
  device_name: string;
  last_seen_at: string;
  created_at: string;
}
