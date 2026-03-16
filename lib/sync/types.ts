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

export interface SyncQueueItem {
  id: string;
  taskId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: number;
  retryCount: number;
  payload: TaskRecord | null;
  lastAttemptAt?: number;
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
