# GSD + Cascade Unified Sync Architecture

**Implementation Plan for Shared OAuth/OIDC/PKCE Sync System**

**Version:** 1.0
**Date:** 2025-10-25
**Author:** Claude Code
**Status:** Planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Monorepo Structure](#monorepo-structure)
4. [Package Specifications](#package-specifications)
5. [Database Schema](#database-schema)
6. [TypeScript Interfaces](#typescript-interfaces)
7. [Implementation Phases](#implementation-phases)
8. [Migration Scripts](#migration-scripts)
9. [Testing Strategy](#testing-strategy)
10. [Security Considerations](#security-considerations)
11. [Deployment Guide](#deployment-guide)
12. [Timeline & Effort](#timeline--effort)
13. [Risk Mitigation](#risk-mitigation)

---

## Executive Summary

### Objective
Create a unified, reusable sync infrastructure that serves both GSD Task Manager and Cascade applications using a monorepo architecture with shared packages and a multi-tenant Cloudflare Worker backend.

### Key Benefits
- **Single Source of Truth**: One codebase for sync logic, OAuth, and encryption
- **Cost Efficiency**: Shared Cloudflare Worker reduces infrastructure costs
- **Maintainability**: Bug fixes and features propagate to both apps automatically
- **Type Safety**: Full TypeScript support with shared types
- **Flexibility**: Adapter pattern allows different state management (Dexie vs Zustand)

### High-Level Approach
1. Create pnpm workspace monorepo
2. Extract sync logic into framework-agnostic packages
3. Build adapters for Dexie (GSD) and Zustand (Cascade)
4. Deploy unified multi-tenant Cloudflare Worker
5. Migrate both apps incrementally with zero downtime

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
├──────────────────────────┬──────────────────────────────────┤
│   GSD Task Manager       │        Cascade Kanban            │
│   (Dexie + IndexedDB)    │     (Zustand + IndexedDB)        │
└────────┬─────────────────┴──────────────┬──────────────────┘
         │                                 │
         │  @gsd/sync-client-dexie        │  @gsd/sync-client-zustand
         └────────┬────────────────────────┘
                  │
         ┌────────▼────────┐
         │  @gsd/sync-core │ (Framework-agnostic)
         │  @gsd/sync-oauth│
         └────────┬────────┘
                  │
         ┌────────▼────────────────────┐
         │   Cloudflare Worker API     │
         │   (Multi-tenant backend)    │
         ├─────────────────────────────┤
         │  D1 Database (SQLite)       │
         │  KV Storage (Sessions)      │
         │  R2 Storage (Backups)       │
         └─────────────────────────────┘
                  │
         ┌────────▼────────┐
         │  OAuth Providers│
         │  Google | Apple │
         └─────────────────┘
```

### Data Flow

```
User Action → App State → Sync Adapter → Core Sync → API Client → Worker → Database
                ↑                                                      ↓
                └──────────────── Sync Response ──────────────────────┘
```

### Multi-Tenancy Strategy

Each app has a unique identifier that's used to:
- Isolate data in shared database (`app_id` column)
- Route OAuth callbacks correctly
- Apply app-specific business rules
- Track metrics separately

---

## Monorepo Structure

```
gsd-sync-monorepo/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Run tests on all packages
│       ├── deploy-worker.yml         # Deploy Cloudflare Worker
│       └── release.yml               # Version and publish packages
├── packages/
│   ├── sync-core/                    # Core sync logic (framework-agnostic)
│   │   ├── src/
│   │   │   ├── crypto/
│   │   │   │   ├── encryption.ts     # AES-GCM encryption/decryption
│   │   │   │   ├── key-derivation.ts # PBKDF2 key derivation
│   │   │   │   └── checksum.ts       # SHA-256 integrity checks
│   │   │   ├── sync/
│   │   │   │   ├── vector-clock.ts   # Vector clock operations
│   │   │   │   ├── conflict-resolver.ts
│   │   │   │   ├── queue-manager.ts  # Operation queue
│   │   │   │   └── retry-strategy.ts # Exponential backoff
│   │   │   ├── types/
│   │   │   │   ├── sync.ts           # Common sync types
│   │   │   │   ├── crypto.ts         # Crypto types
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sync-oauth/                   # OAuth/OIDC/PKCE implementation
│   │   ├── src/
│   │   │   ├── handshake.ts          # Cross-tab OAuth coordination
│   │   │   ├── pkce.ts               # PKCE challenge/verifier
│   │   │   ├── providers/
│   │   │   │   ├── google.ts
│   │   │   │   └── apple.ts
│   │   │   ├── config.ts             # OAuth configuration
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sync-client-dexie/            # Dexie adapter for GSD
│   │   ├── src/
│   │   │   ├── adapter.ts            # ISyncAdapter implementation
│   │   │   ├── engine.ts             # Sync engine with Dexie
│   │   │   ├── coordinator.ts        # Queue coordination
│   │   │   ├── hooks.ts              # React hooks (useTasks, useSync)
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sync-client-zustand/          # Zustand adapter for Cascade
│   │   ├── src/
│   │   │   ├── adapter.ts            # ISyncAdapter implementation
│   │   │   ├── engine.ts             # Sync engine with Zustand
│   │   │   ├── coordinator.ts
│   │   │   ├── hooks.ts              # React hooks
│   │   │   ├── stores/
│   │   │   │   ├── sync-store.ts     # Zustand sync state
│   │   │   │   └── queue-store.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sync-ui/                      # Shared React components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── sync-button.tsx
│   │   │   │   ├── sync-status.tsx
│   │   │   │   ├── sync-auth-dialog.tsx
│   │   │   │   ├── oauth-buttons.tsx
│   │   │   │   ├── device-manager.tsx
│   │   │   │   └── conflict-resolver.tsx
│   │   │   ├── hooks/
│   │   │   │   └── use-sync-status.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── sync-worker/                  # Cloudflare Worker backend
│       ├── src/
│       │   ├── handlers/
│       │   │   ├── auth.ts           # Login/register/logout
│       │   │   ├── oauth.ts          # OAuth callback handlers
│       │   │   ├── sync.ts           # Push/pull/resolve
│       │   │   └── devices.ts        # Device management
│       │   ├── middleware/
│       │   │   ├── auth.ts           # JWT verification
│       │   │   ├── cors.ts           # Multi-origin CORS
│       │   │   ├── rate-limit.ts     # Per-user rate limiting
│       │   │   └── tenant.ts         # App ID validation
│       │   ├── utils/
│       │   │   ├── crypto.ts
│       │   │   ├── jwt.ts
│       │   │   ├── logger.ts
│       │   │   └── vector-clock.ts
│       │   ├── config.ts
│       │   ├── types.ts
│       │   └── index.ts
│       ├── migrations/
│       │   ├── 001_initial_schema.sql
│       │   ├── 002_oauth_support.sql
│       │   ├── 003_encryption_salt.sql
│       │   └── 004_multi_tenant.sql
│       ├── wrangler.toml
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── gsd-taskmanager/              # Existing GSD app
│   │   ├── (migrated to use packages)
│   │   └── package.json
│   │
│   └── cascade/                      # Existing Cascade app
│       ├── (migrated to use packages)
│       └── package.json
│
├── scripts/
│   ├── migrate-gsd.sh                # Migration helper for GSD
│   ├── migrate-cascade.sh            # Migration helper for Cascade
│   └── setup-dev-env.sh              # Dev environment setup
│
├── .npmrc                            # pnpm workspace config
├── package.json                      # Workspace root
├── pnpm-workspace.yaml               # Workspace definition
├── tsconfig.base.json                # Shared TypeScript config
└── README.md
```

---

## Package Specifications

### Root `package.json`

```json
{
  "name": "gsd-sync-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "deploy:worker": "pnpm --filter @gsd/sync-worker deploy",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "turbo run build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.1",
    "turbo": "^2.0.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  },
  "packageManager": "pnpm@10.18.3"
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### `packages/sync-core/package.json`

```json
{
  "name": "@gsd/sync-core",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./crypto": "./dist/crypto/index.js",
    "./sync": "./dist/sync/index.js",
    "./types": "./dist/types/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "nanoid": "^5.1.6"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  }
}
```

### `packages/sync-oauth/package.json`

```json
{
  "name": "@gsd/sync-oauth",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@gsd/sync-core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  }
}
```

### `packages/sync-client-dexie/package.json`

```json
{
  "name": "@gsd/sync-client-dexie",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "dexie": "^4.0.0",
    "dexie-react-hooks": "^1.1.7"
  },
  "dependencies": {
    "@gsd/sync-core": "workspace:*",
    "@gsd/sync-oauth": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  }
}
```

### `packages/sync-client-zustand/package.json`

```json
{
  "name": "@gsd/sync-client-zustand",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "dependencies": {
    "@gsd/sync-core": "workspace:*",
    "@gsd/sync-oauth": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  }
}
```

### `packages/sync-ui/package.json`

```json
{
  "name": "@gsd/sync-ui",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "lucide-react": "^0.540.0"
  },
  "dependencies": {
    "@gsd/sync-core": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  }
}
```

### `packages/sync-worker/wrangler.toml`

```toml
name = "gsd-sync-worker"
main = "src/index.ts"
compatibility_date = "2025-01-15"

# Multi-environment configuration
[env.development]
vars = { ENVIRONMENT = "development" }
d1_databases = [
  { binding = "DB", database_name = "gsd-sync-dev", database_id = "xxx" }
]
kv_namespaces = [
  { binding = "KV", id = "xxx" }
]
r2_buckets = [
  { binding = "R2_BACKUPS", bucket_name = "gsd-backups-dev" }
]

[env.production]
vars = { ENVIRONMENT = "production" }
d1_databases = [
  { binding = "DB", database_name = "gsd-sync-prod", database_id = "yyy" }
]
kv_namespaces = [
  { binding = "KV", id = "yyy" }
]
r2_buckets = [
  { binding = "R2_BACKUPS", bucket_name = "gsd-backups-prod" }
]

# Secrets (set via wrangler secret put)
# JWT_SECRET
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
# APPLE_CLIENT_ID
# APPLE_TEAM_ID
# APPLE_KEY_ID
# APPLE_PRIVATE_KEY
```

---

## Database Schema

### Migration: `004_multi_tenant.sql`

```sql
-- Add app_id column to support multiple applications
ALTER TABLE users ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE encrypted_tasks ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE devices ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE sync_metadata ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE sync_operations ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE conflict_log ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';

-- Create indexes for multi-tenant queries
CREATE INDEX idx_users_app_email ON users(app_id, email);
CREATE INDEX idx_tasks_app_user ON encrypted_tasks(app_id, user_id, deleted_at);
CREATE INDEX idx_devices_app_user ON devices(app_id, user_id, is_active);
CREATE INDEX idx_sync_meta_app_user ON sync_metadata(app_id, user_id, last_sync_at);

-- Add app-specific metadata table
CREATE TABLE IF NOT EXISTS app_config (
  app_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  allowed_origins TEXT NOT NULL, -- JSON array of allowed CORS origins
  oauth_redirect_uri TEXT,
  max_tasks_per_user INTEGER DEFAULT 10000,
  max_devices_per_user INTEGER DEFAULT 10,
  features TEXT, -- JSON object of enabled features
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Insert default app configurations
INSERT INTO app_config (app_id, display_name, allowed_origins, oauth_redirect_uri, created_at, updated_at)
VALUES
  ('gsd', 'GSD Task Manager', '["https://gsd.vinny.dev", "http://localhost:3000"]', 'https://gsd.vinny.dev/', UNIXEPOCH() * 1000, UNIXEPOCH() * 1000),
  ('cascade', 'Cascade Kanban', '["https://cascade.vinny.dev", "http://localhost:3000"]', 'https://cascade.vinny.dev/', UNIXEPOCH() * 1000, UNIXEPOCH() * 1000);

-- Add cascade-specific data validation
-- (Cascade uses board-based structure, GSD uses quadrant-based)
-- The encrypted_blob is opaque to the server, so schema validation happens client-side
```

### Complete Schema Reference

```sql
-- Users table (OAuth-based authentication)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'gsd',
  email TEXT NOT NULL,
  auth_provider TEXT CHECK(auth_provider IN ('google', 'apple')),
  provider_user_id TEXT,
  encryption_salt TEXT, -- Client-generated, stored for key derivation
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  account_status TEXT CHECK(account_status IN ('active', 'suspended', 'deleted')) DEFAULT 'active',
  UNIQUE(app_id, email)
);

-- Devices table (multi-device support)
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'gsd',
  user_id TEXT NOT NULL,
  device_name TEXT,
  device_fingerprint TEXT,
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Encrypted tasks (end-to-end encrypted blobs)
CREATE TABLE encrypted_tasks (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'gsd',
  user_id TEXT NOT NULL,
  encrypted_blob TEXT NOT NULL, -- AES-GCM encrypted task data
  nonce TEXT NOT NULL, -- Unique nonce for each encryption
  version INTEGER NOT NULL DEFAULT 1,
  vector_clock TEXT NOT NULL, -- JSON: {"device1": 5, "device2": 3}
  deleted_at INTEGER, -- Soft delete timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_modified_device TEXT,
  checksum TEXT NOT NULL, -- SHA-256 integrity check
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sync metadata (tracks sync state per device)
CREATE TABLE sync_metadata (
  app_id TEXT NOT NULL DEFAULT 'gsd',
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_sync_at INTEGER NOT NULL,
  last_pull_vector TEXT NOT NULL, -- JSON vector clock
  last_push_vector TEXT NOT NULL,
  sync_status TEXT CHECK(sync_status IN ('success', 'conflict', 'error')) DEFAULT 'success',
  PRIMARY KEY(app_id, user_id, device_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Sync operations log (audit trail)
CREATE TABLE sync_operations (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'gsd',
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  operation_type TEXT CHECK(operation_type IN ('push', 'pull', 'resolve')) NOT NULL,
  vector_clock TEXT NOT NULL,
  task_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Conflict log (manual conflict resolution tracking)
CREATE TABLE conflict_log (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'gsd',
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  conflict_type TEXT CHECK(conflict_type IN ('concurrent_edit', 'delete_edit', 'duplicate_id')) NOT NULL,
  device_a TEXT,
  device_b TEXT,
  resolution TEXT CHECK(resolution IN ('manual', 'auto_merge', 'last_write_wins')) NOT NULL,
  resolved_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## TypeScript Interfaces

### `packages/sync-core/src/types/sync.ts`

```typescript
/**
 * Core sync types shared across all adapters
 */

export interface VectorClock {
  [deviceId: string]: number;
}

export type ConflictStrategy = 'last_write_wins' | 'manual' | 'auto_merge';

export interface SyncConfig {
  enabled: boolean;
  userId: string | null;
  deviceId: string;
  deviceName: string;
  email: string | null;
  token: string | null;
  tokenExpiresAt: number | null;
  lastSyncAt: number | null;
  vectorClock: VectorClock;
  conflictStrategy: ConflictStrategy;
  serverUrl: string;
  appId: 'gsd' | 'cascade';
}

export interface SyncQueueItem<T = unknown> {
  id: string;
  taskId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: number;
  retryCount: number;
  payload: T | null;
  vectorClock: VectorClock;
  consolidatedFrom?: string[];
  lastAttemptAt?: number;
}

export interface EncryptedBlob {
  encryptedData: string;
  nonce: string;
  checksum: string;
}

export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  taskId: string;
  encryptedBlob?: string;
  nonce?: string;
  vectorClock: VectorClock;
  checksum?: string;
}

export interface ConflictInfo<T = unknown> {
  taskId: string;
  local: T;
  remote: T;
  localClock: VectorClock;
  remoteClock: VectorClock;
}

export interface SyncResult {
  status: 'success' | 'error' | 'conflict' | 'already_running';
  pushedCount?: number;
  pulledCount?: number;
  conflictsResolved?: number;
  conflicts?: ConflictInfo[];
  timestamp?: number;
  error?: string;
}

/**
 * Adapter interface that must be implemented by each state management system
 */
export interface ISyncAdapter<T = unknown> {
  /**
   * Get all pending operations from the local queue
   */
  getPendingOperations(): Promise<SyncQueueItem<T>[]>;

  /**
   * Add an operation to the sync queue
   */
  queueOperation(op: SyncQueueItem<T>): Promise<void>;

  /**
   * Remove operations from the queue after successful sync
   */
  clearOperations(ids: string[]): Promise<void>;

  /**
   * Get the current local vector clock
   */
  getVectorClock(): Promise<VectorClock>;

  /**
   * Update the local vector clock
   */
  updateVectorClock(clock: VectorClock): Promise<void>;

  /**
   * Get sync configuration
   */
  getSyncConfig(): Promise<SyncConfig>;

  /**
   * Update sync configuration
   */
  updateSyncConfig(config: Partial<SyncConfig>): Promise<void>;

  /**
   * Apply remote changes to local state
   */
  applyRemoteChanges(tasks: T[], deletedIds: string[]): Promise<void>;

  /**
   * Serialize local data for encryption
   */
  serializeTask(task: T): string;

  /**
   * Deserialize decrypted data
   */
  deserializeTask(data: string): T;

  /**
   * Handle conflicts based on strategy
   */
  resolveConflict(conflict: ConflictInfo<T>, strategy: ConflictStrategy): Promise<T>;
}
```

### `packages/sync-core/src/types/crypto.ts`

```typescript
/**
 * Cryptography types
 */

export interface EncryptionKey {
  key: CryptoKey;
  salt: Uint8Array;
}

export interface EncryptionResult {
  encryptedData: string; // Base64-encoded
  nonce: string; // Base64-encoded
  checksum: string; // SHA-256 hex
}

export interface DecryptionParams {
  encryptedData: string;
  nonce: string;
  checksum?: string; // Optional verification
}

export interface KeyDerivationParams {
  password: string;
  salt: Uint8Array;
  iterations?: number;
  keyLength?: number;
}
```

### `packages/sync-oauth/src/types.ts`

```typescript
/**
 * OAuth/OIDC types
 */

export type OAuthProvider = 'google' | 'apple';

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string; // Not used in PKCE flow on client
  redirectUri: string;
  scope: string[];
  authEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  provider: OAuthProvider;
  appId: 'gsd' | 'cascade';
  timestamp: number;
}

export interface OAuthAuthData {
  userId: string;
  deviceId: string;
  email: string;
  token: string;
  expiresAt: number;
  requiresEncryptionSetup?: boolean;
  encryptionSalt?: string;
  provider: OAuthProvider;
}

export interface OAuthHandshakeSuccess {
  status: 'success';
  state: string;
  authData: OAuthAuthData;
}

export interface OAuthHandshakeError {
  status: 'error';
  state: string;
  error: string;
}

export type OAuthHandshakeEvent = OAuthHandshakeSuccess | OAuthHandshakeError;
```

---

## Implementation Phases

### Phase 0: Planning & Setup (3 days)

**Tasks:**
- [ ] Review and approve this implementation plan
- [ ] Create monorepo repository structure
- [ ] Set up pnpm workspaces
- [ ] Configure Turborepo for build orchestration
- [ ] Set up CI/CD workflows (GitHub Actions)
- [ ] Create feature branch for migration

**Deliverables:**
- Empty monorepo with correct structure
- CI/CD pipeline running
- Development environment documented

---

### Phase 1: Extract Core Sync Logic (5 days)

**Goal:** Create framework-agnostic sync packages

#### Day 1-2: `@gsd/sync-core`
```bash
# Create package
mkdir -p packages/sync-core/src/{crypto,sync,types}

# Extract from GSD
cp lib/sync/vector-clock.ts packages/sync-core/src/sync/
cp lib/sync/crypto.ts packages/sync-core/src/crypto/encryption.ts
cp lib/sync/types.ts packages/sync-core/src/types/

# Refactor to remove framework dependencies
# Remove React/Dexie imports
# Extract pure functions
```

**Files to create:**
- `packages/sync-core/src/crypto/encryption.ts`
- `packages/sync-core/src/crypto/key-derivation.ts`
- `packages/sync-core/src/crypto/checksum.ts`
- `packages/sync-core/src/sync/vector-clock.ts`
- `packages/sync-core/src/sync/conflict-resolver.ts`
- `packages/sync-core/src/sync/queue-manager.ts`
- `packages/sync-core/src/types/index.ts`

**Tests:**
```typescript
// packages/sync-core/tests/vector-clock.test.ts
import { describe, it, expect } from 'vitest';
import { mergeVectorClocks, compareVectorClocks } from '../src/sync/vector-clock';

describe('Vector Clock Operations', () => {
  it('should merge clocks correctly', () => {
    const clock1 = { device1: 5, device2: 3 };
    const clock2 = { device2: 4, device3: 2 };
    const merged = mergeVectorClocks(clock1, clock2);

    expect(merged).toEqual({ device1: 5, device2: 4, device3: 2 });
  });

  it('should detect concurrent edits', () => {
    const clock1 = { device1: 5, device2: 3 };
    const clock2 = { device1: 4, device2: 4 };

    expect(compareVectorClocks(clock1, clock2)).toBe('concurrent');
  });
});
```

#### Day 3-4: `@gsd/sync-oauth`

**Files to create:**
```typescript
// packages/sync-oauth/src/pkce.ts
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

// packages/sync-oauth/src/handshake.ts
// Extract from lib/sync/oauth-handshake.ts
// Make provider-agnostic

// packages/sync-oauth/src/providers/google.ts
export const googleOAuthConfig: OAuthConfig = {
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scope: ['openid', 'email', 'profile'],
};

// packages/sync-oauth/src/providers/apple.ts
export const appleOAuthConfig: OAuthConfig = {
  authEndpoint: 'https://appleid.apple.com/auth/authorize',
  tokenEndpoint: 'https://appleid.apple.com/auth/token',
  scope: ['name', 'email'],
};
```

#### Day 5: Testing & Documentation

- Write comprehensive tests for core packages
- Document public APIs
- Create usage examples
- Run type checks across packages

**Deliverables:**
- `@gsd/sync-core` published to workspace
- `@gsd/sync-oauth` published to workspace
- 100% test coverage on critical paths
- API documentation

---

### Phase 2: Build State Management Adapters (5 days)

#### Day 6-7: `@gsd/sync-client-dexie`

```typescript
// packages/sync-client-dexie/src/adapter.ts
import { ISyncAdapter, SyncQueueItem, VectorClock } from '@gsd/sync-core';
import { getDb } from './db'; // Re-export from GSD's db.ts

export class DexieSyncAdapter implements ISyncAdapter<TaskRecord> {
  async getPendingOperations(): Promise<SyncQueueItem<TaskRecord>[]> {
    const db = getDb();
    return db.syncQueue.toArray();
  }

  async queueOperation(op: SyncQueueItem<TaskRecord>): Promise<void> {
    const db = getDb();
    await db.syncQueue.put(op);
  }

  async clearOperations(ids: string[]): Promise<void> {
    const db = getDb();
    await db.syncQueue.bulkDelete(ids);
  }

  async getVectorClock(): Promise<VectorClock> {
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config');
    return config?.vectorClock || {};
  }

  async updateVectorClock(clock: VectorClock): Promise<void> {
    const db = getDb();
    await db.syncMetadata.update('sync_config', { vectorClock: clock });
  }

  async getSyncConfig(): Promise<SyncConfig> {
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config');
    if (!config) throw new Error('Sync not configured');
    return config as SyncConfig;
  }

  async updateSyncConfig(config: Partial<SyncConfig>): Promise<void> {
    const db = getDb();
    await db.syncMetadata.update('sync_config', config);
  }

  async applyRemoteChanges(tasks: TaskRecord[], deletedIds: string[]): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.tasks, async () => {
      // Apply creates/updates
      await db.tasks.bulkPut(tasks);

      // Apply deletes
      await db.tasks.bulkDelete(deletedIds);
    });
  }

  serializeTask(task: TaskRecord): string {
    return JSON.stringify(task);
  }

  deserializeTask(data: string): TaskRecord {
    return JSON.parse(data);
  }

  async resolveConflict(
    conflict: ConflictInfo<TaskRecord>,
    strategy: ConflictStrategy
  ): Promise<TaskRecord> {
    switch (strategy) {
      case 'last_write_wins':
        // Compare timestamps
        return conflict.remote.updatedAt > conflict.local.updatedAt
          ? conflict.remote
          : conflict.local;

      case 'manual':
        // Throw to trigger manual resolution UI
        throw new Error('Manual conflict resolution required');

      case 'auto_merge':
        // Implement field-level merge
        return this.autoMerge(conflict.local, conflict.remote);

      default:
        return conflict.remote;
    }
  }

  private autoMerge(local: TaskRecord, remote: TaskRecord): TaskRecord {
    // Smart merge logic: combine non-conflicting changes
    return {
      ...remote,
      // Keep local changes to specific fields if remote hasn't changed them
      tags: [...new Set([...local.tags, ...remote.tags])],
      subtasks: this.mergeSubtasks(local.subtasks, remote.subtasks),
    };
  }

  private mergeSubtasks(local: Subtask[], remote: Subtask[]): Subtask[] {
    // Merge by ID, prefer completed status from either side
    const merged = new Map<string, Subtask>();

    for (const subtask of [...local, ...remote]) {
      const existing = merged.get(subtask.id);
      if (!existing || subtask.completed) {
        merged.set(subtask.id, subtask);
      }
    }

    return Array.from(merged.values());
  }
}
```

```typescript
// packages/sync-client-dexie/src/engine.ts
import { encrypt, decrypt } from '@gsd/sync-core/crypto';
import { ISyncAdapter, SyncResult } from '@gsd/sync-core';

export class DexieSyncEngine {
  constructor(private adapter: ISyncAdapter) {}

  async sync(priority: 'user' | 'auto' = 'auto'): Promise<SyncResult> {
    const config = await this.adapter.getSyncConfig();

    if (!config.enabled || !config.token) {
      return { status: 'error', error: 'Sync not enabled' };
    }

    // Step 1: Push local changes
    const pushResult = await this.push();
    if (pushResult.status === 'error') {
      return pushResult;
    }

    // Step 2: Pull remote changes
    const pullResult = await this.pull();
    if (pullResult.status === 'error') {
      return pullResult;
    }

    return {
      status: 'success',
      pushedCount: pushResult.pushedCount,
      pulledCount: pullResult.pulledCount,
      timestamp: Date.now(),
    };
  }

  private async push(): Promise<SyncResult> {
    // Implementation from GSD's engine.ts
    // Use adapter methods instead of direct Dexie calls
  }

  private async pull(): Promise<SyncResult> {
    // Implementation from GSD's engine.ts
    // Use adapter methods instead of direct Dexie calls
  }
}
```

#### Day 8-9: `@gsd/sync-client-zustand`

```typescript
// packages/sync-client-zustand/src/adapter.ts
import { ISyncAdapter, SyncQueueItem, VectorClock } from '@gsd/sync-core';
import { useSyncStore } from './stores/sync-store';
import { taskDB } from '@/lib/utils/database'; // Cascade's database

export class ZustandSyncAdapter implements ISyncAdapter<CascadeTask> {
  async getPendingOperations(): Promise<SyncQueueItem<CascadeTask>[]> {
    // Read from Cascade's IndexedDB
    const queue = await taskDB.syncQueue.toArray();
    return queue;
  }

  async queueOperation(op: SyncQueueItem<CascadeTask>): Promise<void> {
    await taskDB.syncQueue.add(op);

    // Also update Zustand store for UI reactivity
    useSyncStore.getState().addPendingOperation(op);
  }

  async clearOperations(ids: string[]): Promise<void> {
    await taskDB.syncQueue.bulkDelete(ids);
    useSyncStore.getState().removePendingOperations(ids);
  }

  async getVectorClock(): Promise<VectorClock> {
    const config = useSyncStore.getState().config;
    return config.vectorClock;
  }

  async updateVectorClock(clock: VectorClock): Promise<void> {
    useSyncStore.getState().updateVectorClock(clock);
    await taskDB.syncMetadata.put({ key: 'vector_clock', value: clock });
  }

  async getSyncConfig(): Promise<SyncConfig> {
    return useSyncStore.getState().config;
  }

  async updateSyncConfig(config: Partial<SyncConfig>): Promise<void> {
    useSyncStore.getState().updateConfig(config);
    await taskDB.syncMetadata.put({ key: 'sync_config', value: config });
  }

  async applyRemoteChanges(tasks: CascadeTask[], deletedIds: string[]): Promise<void> {
    // Update Cascade's task database
    await taskDB.transaction('rw', taskDB.tasks, async () => {
      for (const task of tasks) {
        await taskDB.tasks.put(task);
      }
      await taskDB.tasks.bulkDelete(deletedIds);
    });

    // Update Zustand stores
    const { updateTask, deleteTask } = await import('@/lib/stores/taskStore');
    for (const task of tasks) {
      updateTask(task);
    }
    for (const id of deletedIds) {
      deleteTask(id);
    }
  }

  serializeTask(task: CascadeTask): string {
    return JSON.stringify(task);
  }

  deserializeTask(data: string): CascadeTask {
    return JSON.parse(data);
  }

  async resolveConflict(
    conflict: ConflictInfo<CascadeTask>,
    strategy: ConflictStrategy
  ): Promise<CascadeTask> {
    // Similar to Dexie adapter
    // Cascade-specific merge logic
  }
}

interface CascadeTask {
  id: string;
  boardId: string;
  title: string;
  description: string;
  column: 'todo' | 'inprogress' | 'done';
  priority: number;
  createdAt: number;
  updatedAt: number;
}
```

```typescript
// packages/sync-client-zustand/src/stores/sync-store.ts
import { create } from 'zustand';
import { SyncConfig, SyncQueueItem } from '@gsd/sync-core';

interface SyncState {
  config: SyncConfig;
  isRunning: boolean;
  pendingOperations: SyncQueueItem[];
  lastSyncAt: number | null;
  error: string | null;

  updateConfig: (config: Partial<SyncConfig>) => void;
  setRunning: (running: boolean) => void;
  addPendingOperation: (op: SyncQueueItem) => void;
  removePendingOperations: (ids: string[]) => void;
  updateVectorClock: (clock: VectorClock) => void;
  setError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  config: {
    enabled: false,
    userId: null,
    deviceId: crypto.randomUUID(),
    deviceName: 'Unknown Device',
    email: null,
    token: null,
    tokenExpiresAt: null,
    lastSyncAt: null,
    vectorClock: {},
    conflictStrategy: 'last_write_wins',
    serverUrl: 'https://gsd-sync-worker.vscarpenter.workers.dev',
    appId: 'cascade',
  },
  isRunning: false,
  pendingOperations: [],
  lastSyncAt: null,
  error: null,

  updateConfig: (config) => set((state) => ({
    config: { ...state.config, ...config }
  })),

  setRunning: (running) => set({ isRunning: running }),

  addPendingOperation: (op) => set((state) => ({
    pendingOperations: [...state.pendingOperations, op]
  })),

  removePendingOperations: (ids) => set((state) => ({
    pendingOperations: state.pendingOperations.filter(op => !ids.includes(op.id))
  })),

  updateVectorClock: (clock) => set((state) => ({
    config: { ...state.config, vectorClock: clock }
  })),

  setError: (error) => set({ error }),
}));
```

#### Day 10: Testing & Integration

- Test both adapters with mock backends
- Verify adapter interface compliance
- Cross-platform compatibility tests
- Performance benchmarking

**Deliverables:**
- `@gsd/sync-client-dexie` complete
- `@gsd/sync-client-zustand` complete
- Adapter test suites passing
- Performance benchmarks documented

---

### Phase 3: Build Shared Worker Backend (5 days)

#### Day 11-12: Multi-Tenant Infrastructure

```typescript
// packages/sync-worker/src/middleware/tenant.ts
import type { Env } from '../types';

export async function validateAppId(
  appId: string,
  env: Env
): Promise<boolean> {
  const config = await env.DB.prepare(
    'SELECT app_id FROM app_config WHERE app_id = ?'
  ).bind(appId).first();

  return !!config;
}

export function extractAppId(request: Request): string | null {
  // Check header first
  const headerAppId = request.headers.get('X-App-ID');
  if (headerAppId) return headerAppId;

  // Check query parameter
  const url = new URL(request.url);
  const queryAppId = url.searchParams.get('app_id');
  if (queryAppId) return queryAppId;

  // Check referer origin
  const referer = request.headers.get('Referer');
  if (referer) {
    const refererUrl = new URL(referer);
    if (refererUrl.hostname === 'gsd.vinny.dev') return 'gsd';
    if (refererUrl.hostname === 'cascade.vinny.dev') return 'cascade';
    if (refererUrl.hostname === 'localhost') {
      // Use port to differentiate local dev
      return refererUrl.port === '3000' ? 'gsd' : 'cascade';
    }
  }

  return null;
}

export async function tenantMiddleware(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response | null> {
  const appId = extractAppId(request);

  if (!appId) {
    return jsonResponse(
      { error: 'Missing app identifier. Include X-App-ID header or app_id parameter.' },
      400
    );
  }

  const isValid = await validateAppId(appId, env);
  if (!isValid) {
    return jsonResponse({ error: 'Invalid app identifier' }, 400);
  }

  // Add to context for downstream handlers
  ctx.appId = appId;
  return null; // Continue to next middleware
}
```

```typescript
// packages/sync-worker/src/middleware/cors.ts
import type { Env } from '../types';

export async function getCorsAllowedOrigins(
  appId: string,
  env: Env
): Promise<string[]> {
  const config = await env.DB.prepare(
    'SELECT allowed_origins FROM app_config WHERE app_id = ?'
  ).bind(appId).first();

  if (!config) return [];

  return JSON.parse(config.allowed_origins as string);
}

export async function corsMiddleware(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response | null> {
  const origin = request.headers.get('Origin');
  const appId = ctx.appId || 'gsd';

  if (!origin) return null;

  const allowedOrigins = await getCorsAllowedOrigins(appId, env);

  if (allowedOrigins.includes(origin)) {
    ctx.corsOrigin = origin;
    return null;
  }

  // Reject if origin not allowed
  return jsonResponse({ error: 'Origin not allowed' }, 403);
}

export function createCorsHeaders(origin?: string): Headers {
  const headers = new Headers();

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-ID');
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}
```

#### Day 13-14: Update Handlers for Multi-Tenancy

```typescript
// packages/sync-worker/src/handlers/sync.ts
// Update all handlers to include app_id in queries

export async function push(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const appId = ctx.appId!;
  const userId = ctx.userId!;
  const body = await request.json();
  const validated = pushRequestSchema.parse(body);

  // ... existing push logic, but add appId to all queries

  for (const op of validated.operations) {
    const existing = await env.DB.prepare(
      'SELECT * FROM encrypted_tasks WHERE id = ? AND user_id = ? AND app_id = ?'
    )
      .bind(op.taskId, userId, appId) // ADD appId
      .first();

    // ... rest of logic
  }

  // ... rest of push implementation
}

export async function pull(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const appId = ctx.appId!;
  const userId = ctx.userId!;
  const body = await request.json();
  const validated = pullRequestSchema.parse(body);

  // Fetch tasks for this app only
  const tasks = await env.DB.prepare(
    `SELECT * FROM encrypted_tasks
     WHERE user_id = ? AND app_id = ? AND updated_at >= ? AND deleted_at IS NULL
     ORDER BY updated_at ASC
     LIMIT ?`
  )
    .bind(userId, appId, validated.sinceTimestamp || 0, validated.limit || 50)
    .all();

  // ... rest of pull implementation
}
```

#### Day 15: OAuth Multi-Tenant Support

```typescript
// packages/sync-worker/src/handlers/oauth.ts

export async function initiateOAuth(
  request: Request,
  env: Env,
  provider: 'google' | 'apple'
): Promise<Response> {
  const url = new URL(request.url);
  const appId = url.searchParams.get('app_id') || 'gsd';

  // Validate app_id
  const isValid = await validateAppId(appId, env);
  if (!isValid) {
    return jsonResponse({ error: 'Invalid app_id' }, 400);
  }

  // Get app-specific redirect URI
  const appConfig = await env.DB.prepare(
    'SELECT oauth_redirect_uri FROM app_config WHERE app_id = ?'
  ).bind(appId).first();

  const redirectUri = appConfig?.oauth_redirect_uri || env.OAUTH_REDIRECT_URI;

  // Generate PKCE challenge
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state with app_id
  await env.KV.put(
    `oauth:state:${state}`,
    JSON.stringify({
      codeVerifier,
      provider,
      appId, // IMPORTANT: Include app ID
      timestamp: Date.now(),
    }),
    { expirationTtl: 600 } // 10 minutes
  );

  // Build provider URL
  const authUrl = new URL(
    provider === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : 'https://appleid.apple.com/auth/authorize'
  );

  authUrl.searchParams.set('client_id', env[`${provider.toUpperCase()}_CLIENT_ID`]);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('scope', provider === 'google' ? 'openid email profile' : 'name email');

  return jsonResponse({ authUrl: authUrl.toString(), state });
}

export async function handleOAuthCallback(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code || !state) {
    return redirectToApp('error', 'OAuth failed', null, env);
  }

  // Retrieve stored state
  const storedState = await env.KV.get(`oauth:state:${state}`, 'json') as OAuthState;
  if (!storedState) {
    return redirectToApp('error', 'Invalid or expired state', null, env);
  }

  const { codeVerifier, provider, appId } = storedState;

  // Exchange code for token
  const tokenResponse = await fetch(
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://appleid.apple.com/auth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env[`${provider.toUpperCase()}_CLIENT_ID`],
        client_secret: env[`${provider.toUpperCase()}_CLIENT_SECRET`],
        redirect_uri: env.OAUTH_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    }
  );

  const tokens = await tokenResponse.json();
  if (!tokens.access_token) {
    return redirectToApp('error', 'Token exchange failed', null, env);
  }

  // Get user info
  const userInfo = await fetchUserInfo(provider, tokens.access_token);

  // Find or create user FOR THIS APP
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND app_id = ? AND auth_provider = ?'
  )
    .bind(userInfo.email, appId, provider) // IMPORTANT: Include app_id
    .first();

  if (!user) {
    // Create new user
    const userId = generateId();
    await env.DB.prepare(
      `INSERT INTO users (id, app_id, email, auth_provider, provider_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(userId, appId, userInfo.email, provider, userInfo.sub, Date.now(), Date.now())
      .run();

    user = { id: userId, email: userInfo.email };
  }

  // Create device
  const deviceId = generateId();
  await env.DB.prepare(
    `INSERT INTO devices (id, app_id, user_id, device_name, last_seen_at, created_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  )
    .bind(deviceId, appId, user.id, 'Browser', Date.now(), Date.now())
    .run();

  // Generate JWT
  const { token, expiresAt } = await createToken(
    user.id as string,
    user.email as string,
    deviceId,
    env.JWT_SECRET
  );

  // Store session
  await env.KV.put(
    `session:${user.id}:${crypto.randomUUID()}`,
    JSON.stringify({ deviceId, issuedAt: Date.now(), expiresAt }),
    { expirationTtl: 60 * 60 * 24 * 7 }
  );

  // Check if encryption setup is needed
  const encryptionSalt = user.encryption_salt as string | null;

  // Store result for handshake
  await env.KV.put(
    `oauth:result:${state}`,
    JSON.stringify({
      userId: user.id,
      deviceId,
      email: user.email,
      token,
      expiresAt,
      requiresEncryptionSetup: !encryptionSalt,
      encryptionSalt: encryptionSalt || undefined,
      provider,
    }),
    { expirationTtl: 300 } // 5 minutes
  );

  // Redirect back to app with state
  return redirectToApp('success', null, state, env, appId);
}

function redirectToApp(
  status: 'success' | 'error',
  error: string | null,
  state: string | null,
  env: Env,
  appId?: string
): Response {
  // Determine redirect URL based on app_id
  const appConfig = await env.DB.prepare(
    'SELECT oauth_redirect_uri FROM app_config WHERE app_id = ?'
  ).bind(appId || 'gsd').first();

  const baseUrl = appConfig?.oauth_redirect_uri || 'https://gsd.vinny.dev';
  const redirectUrl = new URL('/oauth-callback', baseUrl);

  redirectUrl.searchParams.set('status', status);
  if (state) redirectUrl.searchParams.set('state', state);
  if (error) redirectUrl.searchParams.set('error', error);

  return Response.redirect(redirectUrl.toString(), 302);
}
```

**Deliverables:**
- Multi-tenant worker backend
- Migration 004 applied
- All handlers updated for app_id
- OAuth flow tested for both apps

---

### Phase 4: Build Shared UI Components (3 days)

#### Day 16-17: Core Components

```typescript
// packages/sync-ui/src/components/sync-button.tsx
'use client';

import { useState } from 'react';
import { CloudSync, CloudOff, Loader2 } from 'lucide-react';
import type { SyncResult } from '@gsd/sync-core';

export interface SyncButtonProps {
  onSync: () => Promise<SyncResult>;
  isEnabled: boolean;
  isPending?: boolean;
  className?: string;
}

export function SyncButton({
  onSync,
  isEnabled,
  isPending = false,
  className = ''
}: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!isEnabled || syncing) return;

    setSyncing(true);
    setError(null);

    try {
      const result = await onSync();

      if (result.status === 'error') {
        setError(result.error || 'Sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const Icon = syncing || isPending ? Loader2 : isEnabled ? CloudSync : CloudOff;
  const animate = syncing || isPending ? 'animate-spin' : '';

  return (
    <button
      onClick={handleSync}
      disabled={!isEnabled || syncing || isPending}
      className={`sync-button ${className}`}
      aria-label="Sync data"
      title={error || (isEnabled ? 'Sync now' : 'Sync disabled')}
    >
      <Icon className={`h-5 w-5 ${animate}`} />
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </button>
  );
}
```

```typescript
// packages/sync-ui/src/components/oauth-buttons.tsx
'use client';

import { useState } from 'react';

export interface OAuthButtonsProps {
  onGoogleLogin: () => Promise<void>;
  onAppleLogin: () => Promise<void>;
  appId: 'gsd' | 'cascade';
  className?: string;
}

export function OAuthButtons({
  onGoogleLogin,
  onAppleLogin,
  appId,
  className = ''
}: OAuthButtonsProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  const handleGoogle = async () => {
    setLoading('google');
    try {
      await onGoogleLogin();
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setLoading('apple');
    try {
      await onAppleLogin();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`oauth-buttons ${className}`}>
      <button
        onClick={handleGoogle}
        disabled={loading !== null}
        className="oauth-button oauth-button-google"
      >
        {loading === 'google' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span>Continue with Google</span>
      </button>

      <button
        onClick={handleApple}
        disabled={loading !== null}
        className="oauth-button oauth-button-apple"
      >
        {loading === 'apple' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <AppleIcon />
        )}
        <span>Continue with Apple</span>
      </button>
    </div>
  );
}
```

#### Day 18: Additional Components

- `sync-status.tsx` - Display sync state and last sync time
- `device-manager.tsx` - List and revoke devices
- `conflict-resolver.tsx` - Manual conflict resolution UI
- `sync-auth-dialog.tsx` - Authentication modal

**Deliverables:**
- `@gsd/sync-ui` package complete
- Components documented with Storybook (optional)
- Styled with Tailwind CSS
- Accessible (WCAG 2.1 AA)

---

### Phase 5: Migrate GSD Task Manager (4 days)

#### Day 19-20: Replace Sync Logic

```typescript
// apps/gsd-taskmanager/lib/sync/gsd-sync.ts
import { DexieSyncEngine, DexieSyncAdapter } from '@gsd/sync-client-dexie';
import { SyncCoordinator } from '@gsd/sync-core';

// Create adapter
const adapter = new DexieSyncAdapter();

// Create engine
const engine = new DexieSyncEngine(adapter);

// Create coordinator
const coordinator = new SyncCoordinator(engine);

export { coordinator, engine, adapter };
```

```typescript
// apps/gsd-taskmanager/lib/hooks/use-sync.ts
import { useEffect, useState } from 'react';
import { coordinator } from '@/lib/sync/gsd-sync';
import type { SyncResult } from '@gsd/sync-core';

export function useSync() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const requestSync = async (priority: 'user' | 'auto' = 'auto') => {
    setIsRunning(true);
    const result = await coordinator.requestSync(priority);
    setLastResult(result);
    setIsRunning(false);
    return result;
  };

  return { requestSync, isRunning, lastResult };
}
```

```diff
// apps/gsd-taskmanager/package.json
{
  "dependencies": {
-   // Remove old sync files
+   "@gsd/sync-client-dexie": "workspace:*",
+   "@gsd/sync-oauth": "workspace:*",
+   "@gsd/sync-ui": "workspace:*"
  }
}
```

#### Day 21: Update Components

```diff
// apps/gsd-taskmanager/components/sync/sync-button.tsx
- import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
+ import { SyncButton as BaseSyncButton } from '@gsd/sync-ui';
+ import { useSync } from '@/lib/hooks/use-sync';

export function SyncButton() {
-  // Old implementation
+  const { requestSync, isRunning } = useSync();
+  const config = useSyncConfig();
+
+  return (
+    <BaseSyncButton
+      onSync={() => requestSync('user')}
+      isEnabled={config.enabled}
+      isPending={isRunning}
+    />
+  );
}
```

#### Day 22: Testing & Validation

- Test all sync flows (push, pull, conflicts)
- Verify OAuth still works
- Test encryption/decryption
- Performance regression testing
- User acceptance testing

**Deliverables:**
- GSD migrated to shared packages
- All tests passing
- No performance degradation
- Documentation updated

---

### Phase 6: Migrate Cascade (5 days)

#### Day 23-24: Add IndexedDB Sync Tables

```typescript
// apps/cascade/src/lib/utils/database.ts
// Add sync tables to Cascade's existing database

import Dexie, { type Table } from 'dexie';

export class TaskDatabase extends Dexie {
  tasks!: Table<Task>;
  boards!: Table<Board>;
  settings!: Table<Setting>;
  archive!: Table<ArchivedTask>;

  // NEW: Add sync tables
  syncQueue!: Table<SyncQueueItem>;
  syncMetadata!: Table<SyncMetadata>;

  constructor() {
    super('CascadeDB');

    this.version(3).stores({
      tasks: 'id, boardId, column, createdAt',
      boards: 'id, createdAt',
      settings: 'key',
      archive: 'id, archivedAt',
      // NEW
      syncQueue: 'id, taskId, timestamp',
      syncMetadata: 'key',
    });
  }
}

export const taskDB = new TaskDatabase();
```

#### Day 25: Integrate Sync Adapter

```typescript
// apps/cascade/src/lib/sync/cascade-sync.ts
import { ZustandSyncEngine, ZustandSyncAdapter } from '@gsd/sync-client-zustand';
import { SyncCoordinator } from '@gsd/sync-core';

const adapter = new ZustandSyncAdapter();
const engine = new ZustandSyncEngine(adapter);
const coordinator = new SyncCoordinator(engine);

export { coordinator, engine, adapter };
```

```typescript
// apps/cascade/src/lib/stores/taskStore.ts
// Update existing Zustand store to integrate sync

import { create } from 'zustand';
import { taskDB } from '@/lib/utils/database';
import { coordinator } from '@/lib/sync/cascade-sync';

interface TaskState {
  tasks: Task[];
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],

  addTask: async (task) => {
    // Add to local database
    await taskDB.tasks.add(task);

    // Queue for sync
    await coordinator.queueOperation({
      id: crypto.randomUUID(),
      taskId: task.id,
      operation: 'create',
      timestamp: Date.now(),
      retryCount: 0,
      payload: task,
      vectorClock: await coordinator.getVectorClock(),
    });

    // Update Zustand state
    set((state) => ({ tasks: [...state.tasks, task] }));

    // Trigger auto-sync
    coordinator.requestSync('auto');
  },

  updateTask: async (task) => {
    await taskDB.tasks.put(task);

    await coordinator.queueOperation({
      id: crypto.randomUUID(),
      taskId: task.id,
      operation: 'update',
      timestamp: Date.now(),
      retryCount: 0,
      payload: task,
      vectorClock: await coordinator.getVectorClock(),
    });

    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
    }));

    coordinator.requestSync('auto');
  },

  deleteTask: async (id) => {
    await taskDB.tasks.delete(id);

    await coordinator.queueOperation({
      id: crypto.randomUUID(),
      taskId: id,
      operation: 'delete',
      timestamp: Date.now(),
      retryCount: 0,
      payload: null,
      vectorClock: await coordinator.getVectorClock(),
    });

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));

    coordinator.requestSync('auto');
  },
}));
```

#### Day 26: Add UI Components

```typescript
// apps/cascade/src/components/SyncButton.tsx
import { SyncButton as BaseSyncButton } from '@gsd/sync-ui';
import { coordinator } from '@/lib/sync/cascade-sync';
import { useSyncStore } from '@gsd/sync-client-zustand';

export function SyncButton() {
  const config = useSyncStore((state) => state.config);
  const isRunning = useSyncStore((state) => state.isRunning);

  const handleSync = async () => {
    return coordinator.requestSync('user');
  };

  return (
    <BaseSyncButton
      onSync={handleSync}
      isEnabled={config.enabled}
      isPending={isRunning}
    />
  );
}
```

```typescript
// apps/cascade/src/components/Sidebar.tsx
// Add sync button to existing sidebar

import { SyncButton } from './SyncButton';
import { OAuthButtons } from '@gsd/sync-ui';
import { initiateOAuth } from '@/lib/sync/oauth';

export function Sidebar() {
  const syncConfig = useSyncStore((state) => state.config);

  return (
    <aside className="sidebar">
      {/* Existing sidebar content */}

      <div className="sync-section">
        {syncConfig.enabled ? (
          <SyncButton />
        ) : (
          <OAuthButtons
            appId="cascade"
            onGoogleLogin={() => initiateOAuth('google', 'cascade')}
            onAppleLogin={() => initiateOAuth('apple', 'cascade')}
          />
        )}
      </div>
    </aside>
  );
}
```

#### Day 27: Testing & Deployment

- Test Cascade sync end-to-end
- Verify multi-tenant isolation (GSD data ≠ Cascade data)
- Cross-device testing
- Performance testing
- Deploy to production

**Deliverables:**
- Cascade fully syncing
- Multi-tenant worker serving both apps
- Both apps in production
- Migration guide for users

---

### Phase 7: Documentation & Launch (2 days)

#### Day 28: Developer Documentation

Create comprehensive documentation:

- **Architecture Guide** (`docs/architecture.md`)
- **API Reference** (`docs/api-reference.md`)
- **Migration Guide** (`docs/migration.md`)
- **Contributing Guide** (`CONTRIBUTING.md`)
- **Security Model** (`docs/security.md`)

#### Day 29: User Documentation

- **User Guide** for GSD sync setup
- **User Guide** for Cascade sync setup
- **FAQ** for common issues
- **Privacy Policy** updates
- **Changelog** with migration notes

**Deliverables:**
- Complete documentation
- User-facing guides
- Video tutorials (optional)
- Blog post announcing sync

---

## Migration Scripts

### Script 1: Create Monorepo Structure

```bash
#!/bin/bash
# scripts/setup-monorepo.sh

set -e

echo "🚀 Creating GSD Sync Monorepo..."

# Create root structure
mkdir -p gsd-sync-monorepo/{packages,apps,scripts}
cd gsd-sync-monorepo

# Initialize pnpm workspace
cat > pnpm-workspace.yaml <<EOF
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# Create root package.json
cat > package.json <<EOF
{
  "name": "gsd-sync-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.1",
    "turbo": "^2.0.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  }
}
EOF

# Create turbo.json
cat > turbo.json <<EOF
{
  "\$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF

# Create base TypeScript config
cat > tsconfig.base.json <<EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  }
}
EOF

# Install dependencies
pnpm install

echo "✅ Monorepo structure created!"
echo "Next steps:"
echo "  1. Move GSD and Cascade into apps/"
echo "  2. Extract shared code into packages/"
echo "  3. Run 'pnpm build' to verify"
```

### Script 2: Extract Sync Core

```bash
#!/bin/bash
# scripts/extract-sync-core.sh

set -e

echo "📦 Extracting sync core package..."

PACKAGE_DIR="packages/sync-core"
SOURCE_DIR="apps/gsd-taskmanager/lib/sync"

# Create package structure
mkdir -p "$PACKAGE_DIR/src"/{crypto,sync,types}
mkdir -p "$PACKAGE_DIR/tests"

# Copy source files
echo "Copying vector-clock.ts..."
cp "$SOURCE_DIR/vector-clock.ts" "$PACKAGE_DIR/src/sync/"

echo "Copying crypto.ts..."
cp "$SOURCE_DIR/crypto.ts" "$PACKAGE_DIR/src/crypto/encryption.ts"

echo "Copying types.ts..."
cp "$SOURCE_DIR/types.ts" "$PACKAGE_DIR/src/types/sync.ts"

# Create package.json
cat > "$PACKAGE_DIR/package.json" <<EOF
{
  "name": "@gsd/sync-core",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "nanoid": "^5.1.6"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.3"
  }
}
EOF

# Create tsconfig
cat > "$PACKAGE_DIR/tsconfig.json" <<EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# Create index
cat > "$PACKAGE_DIR/src/index.ts" <<EOF
export * from './crypto/encryption';
export * from './sync/vector-clock';
export * from './types/sync';
EOF

echo "✅ Sync core package extracted!"
echo "Next: cd $PACKAGE_DIR && pnpm build"
```

### Script 3: Database Migration

```sql
-- scripts/migrate-multi-tenant.sql
-- Run with: wrangler d1 execute gsd-sync-prod --file=./scripts/migrate-multi-tenant.sql

BEGIN TRANSACTION;

-- Add app_id column to all tables
ALTER TABLE users ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE encrypted_tasks ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE devices ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE sync_metadata ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE sync_operations ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';
ALTER TABLE conflict_log ADD COLUMN app_id TEXT NOT NULL DEFAULT 'gsd';

-- Create indexes
CREATE INDEX idx_users_app_email ON users(app_id, email);
CREATE INDEX idx_tasks_app_user ON encrypted_tasks(app_id, user_id, deleted_at);
CREATE INDEX idx_devices_app_user ON devices(app_id, user_id, is_active);
CREATE INDEX idx_sync_meta_app_user ON sync_metadata(app_id, user_id, last_sync_at);

-- Create app config table
CREATE TABLE IF NOT EXISTS app_config (
  app_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  allowed_origins TEXT NOT NULL,
  oauth_redirect_uri TEXT,
  max_tasks_per_user INTEGER DEFAULT 10000,
  max_devices_per_user INTEGER DEFAULT 10,
  features TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Insert app configurations
INSERT INTO app_config (app_id, display_name, allowed_origins, oauth_redirect_uri, created_at, updated_at)
VALUES
  ('gsd', 'GSD Task Manager', '["https://gsd.vinny.dev", "http://localhost:3000"]', 'https://gsd.vinny.dev/', UNIXEPOCH() * 1000, UNIXEPOCH() * 1000),
  ('cascade', 'Cascade Kanban', '["https://cascade.vinny.dev", "http://localhost:3000"]', 'https://cascade.vinny.dev/', UNIXEPOCH() * 1000, UNIXEPOCH() * 1000);

COMMIT;
```

---

## Testing Strategy

### Unit Tests

**Coverage Goals:**
- `@gsd/sync-core`: 95%+
- `@gsd/sync-oauth`: 90%+
- `@gsd/sync-client-*`: 85%+
- `@gsd/sync-worker`: 80%+

**Key Test Suites:**

```typescript
// packages/sync-core/tests/vector-clock.test.ts
describe('Vector Clock', () => {
  it('merges clocks correctly');
  it('detects causality');
  it('identifies concurrent edits');
  it('handles empty clocks');
});

// packages/sync-core/tests/conflict-resolver.test.ts
describe('Conflict Resolution', () => {
  it('applies last_write_wins strategy');
  it('throws on manual strategy');
  it('auto-merges compatible changes');
  it('preserves all data on merge');
});

// packages/sync-oauth/tests/pkce.test.ts
describe('PKCE', () => {
  it('generates valid code verifier');
  it('generates correct code challenge');
  it('verifier length is sufficient');
});
```

### Integration Tests

```typescript
// packages/sync-worker/tests/multi-tenant.test.ts
describe('Multi-Tenant Worker', () => {
  it('isolates GSD and Cascade data', async () => {
    // Create GSD user
    const gsdUser = await createUser('test@example.com', 'gsd');

    // Create Cascade user with same email
    const cascadeUser = await createUser('test@example.com', 'cascade');

    // Verify different user IDs
    expect(gsdUser.id).not.toBe(cascadeUser.id);

    // Verify data isolation
    const gsdTasks = await getTasks(gsdUser.token, 'gsd');
    const cascadeTasks = await getTasks(cascadeUser.token, 'cascade');

    expect(gsdTasks).toHaveLength(0);
    expect(cascadeTasks).toHaveLength(0);
  });

  it('rejects cross-app requests', async () => {
    const gsdUser = await createUser('test@example.com', 'gsd');

    // Try to access Cascade data with GSD token
    await expect(
      getTasks(gsdUser.token, 'cascade')
    ).rejects.toThrow('Access denied');
  });
});
```

### End-to-End Tests

```typescript
// apps/gsd-taskmanager/e2e/sync.spec.ts
import { test, expect } from '@playwright/test';

test('sync flow works end-to-end', async ({ page, context }) => {
  // Login
  await page.goto('http://localhost:3000');
  await page.click('[data-testid="google-oauth"]');

  // OAuth flow (mocked)
  await page.waitForURL(/oauth-callback/);

  // Create task on device 1
  await page.fill('[data-testid="task-title"]', 'Test Task');
  await page.click('[data-testid="add-task"]');

  // Wait for auto-sync
  await expect(page.locator('[data-testid="sync-status"]')).toHaveText(/Synced/);

  // Open device 2 (new browser context)
  const device2 = await context.newPage();
  await device2.goto('http://localhost:3000');

  // Login same user
  await device2.click('[data-testid="google-oauth"]');
  await device2.waitForURL(/oauth-callback/);

  // Verify task synced
  await expect(device2.locator('[data-testid="task-item"]')).toContainText('Test Task');
});
```

---

## Security Considerations

### 1. Multi-Tenant Data Isolation

**Risk:** User from one app accessing another app's data

**Mitigation:**
- Always include `app_id` in WHERE clauses
- Use database constraints (UNIQUE on app_id + email)
- Middleware validation before every handler
- Audit logs for cross-app access attempts

### 2. OAuth Security

**Risk:** OAuth state CSRF attacks

**Mitigation:**
- State tokens stored in KV with 10-min TTL
- PKCE code verifier never leaves client
- Validate state on callback
- Verify origin matches app_id

### 3. Encryption Key Management

**Risk:** Encryption salt stored on server

**Mitigation:**
- Salt is client-generated, server only stores
- Server cannot decrypt tasks (zero-knowledge)
- Salt transmission only over HTTPS
- Salt stored with user record (not globally accessible)

### 4. JWT Token Security

**Risk:** Token theft or reuse

**Mitigation:**
- Short-lived tokens (7 days)
- Refresh token rotation
- Session revocation support
- Rate limiting per token

### 5. CORS Configuration

**Risk:** Unauthorized origins accessing API

**Mitigation:**
- Per-app allowed origins in database
- Dynamic CORS headers based on app_id
- No wildcard origins in production
- Credentials only for allowed origins

---

## Deployment Guide

### Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, e2e)
- [ ] TypeScript builds without errors
- [ ] No console warnings in production build
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] OAuth credentials verified
- [ ] CORS origins whitelisted
- [ ] Secrets rotated (if migrating from existing worker)

### Deployment Steps

#### 1. Deploy Worker

```bash
cd packages/sync-worker

# Run migrations
wrangler d1 migrations apply gsd-sync-prod

# Set secrets
wrangler secret put JWT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put APPLE_CLIENT_ID
wrangler secret put APPLE_TEAM_ID
wrangler secret put APPLE_KEY_ID
wrangler secret put APPLE_PRIVATE_KEY

# Deploy to production
wrangler deploy --env production
```

#### 2. Deploy GSD

```bash
cd apps/gsd-taskmanager

# Build
pnpm build

# Deploy to S3/CloudFront
pnpm deploy
```

#### 3. Deploy Cascade

```bash
cd apps/cascade

# Build
pnpm build

# Deploy to S3/CloudFront
pnpm deploy
```

#### 4. Smoke Tests

```bash
# Test GSD OAuth
curl https://gsd-sync-worker.vscarpenter.workers.dev/api/auth/oauth/google/start?app_id=gsd

# Test Cascade OAuth
curl https://gsd-sync-worker.vscarpenter.workers.dev/api/auth/oauth/google/start?app_id=cascade

# Test health
curl https://gsd-sync-worker.vscarpenter.workers.dev/health
```

### Rollback Plan

If deployment fails:

1. **Worker Rollback:**
   ```bash
   wrangler rollback --env production
   ```

2. **Client Rollback:**
   - Revert CloudFront to previous distribution
   - Or: Deploy previous S3 build

3. **Database Rollback:**
   - If migrations fail, restore from R2 backup
   - Drop new columns if safe

---

## Timeline & Effort

### Summary

| Phase | Duration | Effort (dev days) |
|-------|----------|-------------------|
| Phase 0: Planning & Setup | 3 days | 3 |
| Phase 1: Extract Core | 5 days | 5 |
| Phase 2: Build Adapters | 5 days | 5 |
| Phase 3: Shared Worker | 5 days | 5 |
| Phase 4: Shared UI | 3 days | 3 |
| Phase 5: Migrate GSD | 4 days | 4 |
| Phase 6: Migrate Cascade | 5 days | 5 |
| Phase 7: Documentation | 2 days | 2 |
| **Total** | **32 days** | **32 dev days** |

### Calendar Timeline

Assuming 1 full-time developer:
- **Start:** Week 1
- **Core complete:** Week 2
- **Adapters complete:** Week 3
- **Worker complete:** Week 4
- **GSD migrated:** Week 5
- **Cascade migrated:** Week 6
- **Launch:** Week 7

### Effort Distribution

- Development: 70% (22 days)
- Testing: 20% (6 days)
- Documentation: 10% (3 days)

---

## Risk Mitigation

### High-Risk Items

1. **Breaking Changes to Existing Users**
   - **Mitigation:** Feature flag sync in GSD; users opt-in
   - **Mitigation:** Maintain backward compatibility for 1 version
   - **Mitigation:** Thorough testing on production-like data

2. **Data Loss During Migration**
   - **Mitigation:** Automated backups before migration
   - **Mitigation:** Test migrations on staging first
   - **Mitigation:** Rollback scripts prepared

3. **Performance Degradation**
   - **Mitigation:** Benchmark before/after
   - **Mitigation:** Load testing on worker
   - **Mitigation:** Monitor Cloudflare Analytics

4. **OAuth Provider Issues**
   - **Mitigation:** Test OAuth flows extensively
   - **Mitigation:** Fallback to email/password (if needed)
   - **Mitigation:** Clear error messages for users

### Medium-Risk Items

1. **TypeScript Compatibility Issues**
   - **Mitigation:** Strict tsconfig across monorepo
   - **Mitigation:** CI fails on type errors

2. **Dependency Conflicts**
   - **Mitigation:** Use pnpm's strict peer dependencies
   - **Mitigation:** Lock file committed to repo

3. **CORS Issues in Production**
   - **Mitigation:** Test from real domains (not localhost)
   - **Mitigation:** Pre-configure all origins in database

---

## Success Metrics

### Technical Metrics

- **Build Success Rate:** 100% (CI must pass)
- **Test Coverage:** >85% across all packages
- **Type Safety:** 0 TypeScript errors
- **Bundle Size:** No increase >10% for clients
- **API Latency:** <200ms p99 for sync endpoints

### User Metrics

- **Sync Success Rate:** >99%
- **OAuth Completion Rate:** >95%
- **Conflict Rate:** <1% of sync operations
- **User Adoption:** >50% of active users enable sync in 30 days

### Operational Metrics

- **Worker Uptime:** 99.9%
- **Database Query Performance:** <50ms p95
- **Error Rate:** <0.1% of requests
- **Data Loss Events:** 0

---

## Next Steps

After reviewing this plan:

1. **Approve or Request Changes**
   - Review architecture decisions
   - Validate timeline estimates
   - Approve budget/resources

2. **Set Up Repository**
   - Run `scripts/setup-monorepo.sh`
   - Create feature branch: `feature/unified-sync`
   - Invite team members

3. **Kickoff Meeting**
   - Review implementation plan
   - Assign phase owners
   - Set up weekly sync meetings

4. **Begin Phase 0**
   - Execute planning checklist
   - Set up CI/CD
   - Create initial packages

---

## Appendix

### A. Glossary

- **Monorepo:** Single repository containing multiple packages/apps
- **PKCE:** Proof Key for Code Exchange (OAuth security extension)
- **Vector Clock:** Distributed system timestamp for causality tracking
- **Multi-Tenant:** Single backend serving multiple isolated applications
- **Adapter Pattern:** Interface allowing different implementations

### B. References

- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Guide](https://turbo.build/repo/docs)

### C. Contact

For questions about this implementation plan:
- Email: [your email]
- Slack: [your channel]
- GitHub Discussions: [repo discussions]

---

**End of Implementation Plan**
