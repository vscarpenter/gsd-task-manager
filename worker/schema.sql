-- GSD Task Manager Sync Database Schema
-- Database: Cloudflare D1
-- Version: 1.0.0

-- Users table (authentication and account management)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  account_status TEXT DEFAULT 'active' CHECK(account_status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);

-- Devices table (track user devices for selective sync)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_name TEXT,
  device_fingerprint TEXT,
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(user_id, is_active);

-- Sync operations table (central conflict resolution log)
CREATE TABLE IF NOT EXISTS sync_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('push', 'pull', 'resolve')),
  vector_clock TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_ops_user ON sync_operations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_ops_device ON sync_operations(device_id, created_at DESC);

-- Encrypted task blobs (stores encrypted task data)
CREATE TABLE IF NOT EXISTS encrypted_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_blob TEXT NOT NULL,
  nonce TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  vector_clock TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_modified_device TEXT,
  checksum TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enc_tasks_user ON encrypted_tasks(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_enc_tasks_version ON encrypted_tasks(id, version);
CREATE INDEX IF NOT EXISTS idx_enc_tasks_deleted ON encrypted_tasks(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Sync metadata (track last successful sync per device)
CREATE TABLE IF NOT EXISTS sync_metadata (
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_sync_at INTEGER NOT NULL,
  last_pull_vector TEXT NOT NULL,
  last_push_vector TEXT NOT NULL,
  sync_status TEXT DEFAULT 'success' CHECK(sync_status IN ('success', 'conflict', 'error')),
  PRIMARY KEY (user_id, device_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_meta_status ON sync_metadata(sync_status);

-- Conflict log (audit trail for manual resolution if needed)
CREATE TABLE IF NOT EXISTS conflict_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL CHECK(conflict_type IN ('concurrent_edit', 'delete_edit', 'duplicate_id')),
  device_a TEXT NOT NULL,
  device_b TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK(resolution IN ('auto_merge', 'last_write_wins', 'manual')),
  resolved_at INTEGER NOT NULL,
  resolution_data TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conflicts_user ON conflict_log(user_id, resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflicts_task ON conflict_log(task_id);
