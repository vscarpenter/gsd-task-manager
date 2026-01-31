/**
 * Sync-specific types
 */

import type { TaskRecord } from '@/lib/types';

// Vector Clock for causality tracking
export interface VectorClock {
  [deviceId: string]: number;
}

// Sync configuration stored in IndexedDB
export interface SyncConfig {
  key: 'sync_config';
  enabled: boolean;
  userId: string | null;
  deviceId: string;
  deviceName: string;
  email: string | null;
  token: string | null;
  tokenExpiresAt: number | null;
  lastSyncAt: number | null;
  vectorClock: VectorClock;
  conflictStrategy: 'last_write_wins' | 'manual';
  serverUrl: string;
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
  vectorClock: VectorClock;
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

// Encrypted task blob for transmission
export interface EncryptedTaskBlob {
  id: string;
  encryptedBlob: string;
  nonce: string;
  version: number;
  vectorClock: VectorClock;
  updatedAt: number;
  checksum: string;
}

// Conflict information
export interface ConflictInfo {
  taskId: string;
  local: TaskRecord;
  remote: TaskRecord;
  localClock: VectorClock;
  remoteClock: VectorClock;
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

// API request/response types

export interface PushRequest {
  deviceId: string;
  operations: SyncOperation[];
  clientVectorClock: VectorClock;
}

export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  taskId: string;
  encryptedBlob?: string;
  nonce?: string;
  vectorClock: VectorClock;
  checksum?: string;
}

export interface PushResponse {
  accepted: string[];
  rejected: RejectedOperation[];
  conflicts: ConflictInfo[];
  serverVectorClock: VectorClock;
}

export interface RejectedOperation {
  taskId: string;
  reason: 'version_mismatch' | 'conflict' | 'validation_error' | 'quota_exceeded';
  details: string;
}

export interface PullRequest {
  deviceId: string;
  lastVectorClock: VectorClock;
  sinceTimestamp?: number;
  limit?: number;
  cursor?: string;
}

export interface PullResponse {
  tasks: EncryptedTaskBlob[];
  deletedTaskIds: string[];
  serverVectorClock: VectorClock;
  conflicts: ConflictInfo[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface SyncStatusResponse {
  lastSyncAt: number | null;
  pendingPushCount: number;
  pendingPullCount: number;
  conflictCount: number;
  deviceCount: number;
  storageUsed: number;
  storageQuota: number;
}
