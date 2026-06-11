/**
 * Sync-specific types for PocketBase backend
 *
 * PocketBase handles auth tokens and realtime subscriptions internally
 * via its SDK.
 */

import type { TaskRecord } from '@/lib/types';

// ============================================================================
// PocketBase sync configuration (stored in IndexedDB syncMetadata table)
// ============================================================================

export interface PBSyncConfig {
  key: 'sync_config';
  enabled: boolean;
  userId: string | null;
  deviceId: string;
  deviceName: string;
  email: string | null;
  provider: string | null;
  lastSyncAt: string | null;
  /**
   * Pull cursor: the max PocketBase server-stamped `updated` observed (ISO
   * form, 30s overlap already subtracted). Server-stamped so one device's
   * skewed clock can never write records behind every other device's cursor.
   * LWW conflict resolution stays on `client_updated_at` — a server-side
   * re-save bumps `updated` without the content being newer. `lastSyncAt`
   * above is the legacy client-stamped cursor, read once for migration and
   * otherwise left untouched.
   */
  lastServerUpdatedAt?: string | null;
  /** ISO timestamp of the last successful sync operation (for UI display) */
  lastSuccessfulSyncAt: string | null;
  // Retry tracking fields
  consecutiveFailures: number;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  nextRetryAt: number | null;
  // Auto-sync configuration
  autoSyncEnabled?: boolean;
  autoSyncIntervalMinutes?: number;
  /**
   * The PocketBase user whose tasks are currently present in local IndexedDB.
   * Preserved across logout so a later login cannot silently replay one user's
   * local tasks into a different cloud account.
   */
  localTaskOwnerUserId?: string | null;
}

// ============================================================================
// Background sync configuration
// ============================================================================

export interface BackgroundSyncConfig {
  enabled: boolean;
  intervalMinutes: number;
  syncOnFocus: boolean;
  syncOnOnline: boolean;
  debounceAfterChangeMs: number;
}

// ============================================================================
// Sync queue (offline operations pending push)
// ============================================================================

export type SyncQueueItemStatus = 'pending' | 'failed';

export interface SyncQueueItem {
  id: string;
  taskId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: number;
  retryCount: number;
  payload: TaskRecord | null;
  /** Lifecycle status. Items hitting MAX_RETRIES transition to 'failed' instead
   *  of being deleted, so unsynced edits are preserved for diagnosis/recovery. */
  status?: SyncQueueItemStatus;
  /** Last error message captured during a failed push attempt (truncated). */
  lastError?: string;
  /** ms since epoch of the most recent attempt. */
  lastAttemptAt?: number;
  /** ms since epoch when the item transitioned to 'failed'. */
  failedAt?: number;
}

// ============================================================================
// Remote task index entry (used by fetchRemoteTaskIndex for push LWW guard)
// ============================================================================

/** One row of the remote task index used by push/pull pre-fetch. */
export interface RemoteTaskIndexEntry {
  pbRecordId: string;
  clientUpdatedAt: string | null;
}

// ============================================================================
// Device info
// ============================================================================

export interface DeviceInfo {
  key: 'device_info';
  deviceId: string;
  deviceName: string;
  createdAt: string;
}

// ============================================================================
// Sync results
// ============================================================================

export interface PBSyncResult {
  status: 'success' | 'error' | 'partial' | 'already_running';
  pushedCount?: number;
  pulledCount?: number;
  failedCount?: number;
  error?: string;
}

// ============================================================================
// Legacy type aliases for backward compatibility during migration
// Re-export these so files that import the old names still compile.
// These will be removed once all consumers are updated.
// ============================================================================

/** @deprecated Use PBSyncConfig instead */
export type SyncConfig = PBSyncConfig;

/** @deprecated Use PBSyncResult instead */
export type SyncResult = PBSyncResult;
