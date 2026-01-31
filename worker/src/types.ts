// Environment bindings for Cloudflare Worker
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2_BACKUPS: R2Bucket;
  JWT_SECRET: string;
  ENCRYPTION_SALT: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  // OAuth providers
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_PRIVATE_KEY: string;
  OAUTH_REDIRECT_URI: string;
  OAUTH_CALLBACK_BASE?: string; // Optional: set in production for CloudFront proxy
}

// Request context (extended by middleware)
export interface RequestContext {
  userId?: string;
  deviceId?: string;
  email?: string;
  rateLimitHeaders?: Record<string, string>;
  executionCtx?: ExecutionContext; // For waitUntil() in non-blocking operations
}

// Vector Clock for causality tracking
export interface VectorClock {
  [deviceId: string]: number;
}

// User record
export interface User {
  id: string;
  email: string;
  auth_provider: 'google' | 'apple';
  provider_user_id: string;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  account_status: 'active' | 'suspended' | 'deleted';
}

// Device record
export interface Device {
  id: string;
  user_id: string;
  device_name: string | null;
  device_fingerprint: string | null;
  last_seen_at: number;
  created_at: number;
  is_active: number;
}

// Encrypted task blob
export interface EncryptedTask {
  id: string;
  user_id: string;
  encrypted_blob: string;
  nonce: string;
  version: number;
  vector_clock: string;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
  last_modified_device: string | null;
  checksum: string;
}

// Sync metadata
export interface SyncMetadata {
  user_id: string;
  device_id: string;
  last_sync_at: number;
  last_pull_vector: string;
  last_push_vector: string;
  sync_status: 'success' | 'conflict' | 'error';
}

// OAuth authentication responses
export interface OAuthResponse {
  userId: string;
  deviceId: string;
  email: string;
  token: string;
  expiresAt: number;
  requiresEncryptionSetup: boolean;
  provider: 'google' | 'apple';
}

// Sync requests/responses
export interface PullRequest {
  deviceId: string;
  lastVectorClock: VectorClock;
  sinceTimestamp?: number;
  limit?: number;
  cursor?: string;
}

export interface EncryptedTaskBlob {
  id: string;
  encryptedBlob: string;
  nonce: string;
  version: number;
  vectorClock: VectorClock;
  updatedAt: number;
  checksum: string;
}

export interface ConflictInfo {
  taskId: string;
  reason: 'concurrent_edit' | 'delete_edit' | 'duplicate_id';
  existingClock?: VectorClock;
  incomingClock?: VectorClock;
}

export interface PullResponse {
  tasks: EncryptedTaskBlob[];
  deletedTaskIds: string[];
  serverVectorClock: VectorClock;
  conflicts: ConflictInfo[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  taskId: string;
  encryptedBlob?: string;
  nonce?: string;
  vectorClock: VectorClock;
  checksum?: string;
}

export interface PushRequest {
  deviceId: string;
  operations: SyncOperation[];
  clientVectorClock: VectorClock;
}

export interface RejectedOperation {
  taskId: string;
  reason: 'version_mismatch' | 'conflict' | 'validation_error' | 'quota_exceeded';
  details: string;
}

export interface PushResponse {
  accepted: string[];
  rejected: RejectedOperation[];
  conflicts: ConflictInfo[];
  serverVectorClock: VectorClock;
}

export interface StatusResponse {
  lastSyncAt: number | null;
  pendingPushCount: number;
  pendingPullCount: number;
  conflictCount: number;
  deviceCount: number;
  storageUsed: number;
  storageQuota: number;
}

export interface DeviceInfo {
  id: string;
  name: string | null;
  lastSeenAt: number;
  isActive: boolean;
  isCurrent: boolean;
}

export interface StatsResponse {
  tasks: Array<{
    id: string;
    encryptedBlob: string;
    nonce: string;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
  }>;
  metadata: {
    totalCount: number;
    activeCount: number;
    deletedCount: number;
    oldestTaskDate: number | null;
    newestTaskDate: number | null;
    storageUsed: number;
  };
}
