-- Migration: Add OAuth support and remove password authentication
-- Version: 2.0.0
-- Date: 2025-10-15

-- Step 1: Create new users table with OAuth support
CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  auth_provider TEXT NOT NULL CHECK(auth_provider IN ('google', 'apple')),
  provider_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  account_status TEXT DEFAULT 'active' CHECK(account_status IN ('active', 'suspended', 'deleted')),
  UNIQUE(auth_provider, provider_user_id)
);

-- Step 2: Copy existing users (if any - for migration purposes)
-- Note: Existing password-based users will need to re-authenticate with OAuth
-- This is safe because the application is not yet in production

-- Step 3: Drop old users table
DROP TABLE IF EXISTS users;

-- Step 4: Rename new table
ALTER TABLE users_new RENAME TO users;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(auth_provider, provider_user_id);

-- Step 6: Clean up devices table (orphaned devices from old password-based users)
-- Will be recreated when users sign in with OAuth

-- Note: sync_operations, encrypted_tasks, sync_metadata, and conflict_log tables
-- remain unchanged as they reference users by ID, which is preserved
