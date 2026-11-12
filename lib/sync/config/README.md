# Sync Config

## Overview

This package reads and writes the sync configuration row. The row lives in the Dexie `syncMetadata` table under the key `sync_config`. The package also holds the two lifecycle steps around it: enabling sync after sign-in and disabling sync on sign-out.

`index.ts` is the barrel. Callers import from `@/lib/sync/config`.

## Interface

- `get-set.ts:getSyncConfig(): Promise<PBSyncConfig | null>`. Reads the `sync_config` row. Returns `null` when the row is absent.
- `get-set.ts:updateSyncConfig(updates: Partial<PBSyncConfig>): Promise<void>`. Reads the current row, merges `updates` over it, and writes it back in one transaction.
- `get-set.ts:getAutoSyncConfig(): Promise<BackgroundSyncConfig>`. Returns the auto-sync settings, with defaults for unset fields.
- `get-set.ts:updateAutoSyncConfig(enabled: boolean, intervalMinutes: number): Promise<void>`. Stores the auto-sync switch and interval.
- `get-set.ts:isSyncEnabled(): Promise<boolean>`. Returns the `enabled` flag, or `false` when no config exists.
- `get-set.ts:getSyncStatus(): Promise<SyncStatus>`. Returns `enabled`, `email`, `lastSyncAt`, `pendingCount`, and `deviceId`.
- `enable.ts:enableSync(): Promise<void>`. Queues every existing local task for the first push.
- `disable.ts:disableSync(): Promise<void>`. Signs the device out of sync and wipes per-user sync state.
- `index.ts`. Re-exports all eight functions above.

## Invariants

- `get-set.ts:updateSyncConfig` throws `"Sync config not initialized"` when no `sync_config` row exists. It never creates the row.
- `get-set.ts:updateSyncConfig` reads the row and writes `{...current, ...updates}` inside one `rw` transaction over `syncMetadata`. It never writes back a row read earlier.
- `get-set.ts:updateAutoSyncConfig` clamps `intervalMinutes` to the range 1 to 30.
- `get-set.ts:getAutoSyncConfig` defaults to enabled, a 2 minute interval, sync on focus, sync on online, and a 30000 ms debounce.
- `disable.ts:resetSyncConfigState` runs one `rw` transaction over `syncMetadata`, `syncQueue`, and `syncHistory`. It takes no argument and reads the `sync_config` row inside that transaction. It writes the disabled config first. A closed tab must never leave Trash deletes queued and unremembered behind a signed-out config.
- `disable.ts:resetSyncConfigState` returns `false` and writes nothing when the row is absent. Otherwise it writes the signed-out row and returns `true`.
- `disable.ts:resetSyncConfigState` keeps `pullCursorVersion` unchanged. Only a completed pull may stamp a newer one (ADR 0019).
- `disable.ts:resetSyncConfigState` remembers the id of every queued Trash delete before it clears the queue. It calls `rememberForResurrect(trashDeleteTaskIds(...))` for this.
- `disable.ts:resetSyncConfigState` clears `syncHistory` for privacy on shared devices. The next user must not see the previous user's sync metadata, queue, or history.
- `disable.ts:disableSync` reads nothing before it calls `resetSyncConfigState`. It persists the disabled config before any other awaited step. Pull, realtime, reconciliation, resurrection, cursor, and outcome writes re-read the row before each write, so they stop. A push in flight re-reads it before each row and inside each `syncQueue` and `tasks` write, so it stops at its next step. A request already sent still completes.
- `disable.ts:resetSyncConfigState` sets `localTaskOwnerUserId` to the prior `localTaskOwnerUserId`, else the prior `userId`, else `null`.

## Side Effects

- `get-set.ts:getSyncConfig` reads `syncMetadata`. `get-set.ts:updateSyncConfig` reads and writes `syncMetadata` in one `rw` transaction.
- `get-set.ts:getSyncStatus` reads `syncMetadata` and counts `syncQueue`.
- `enable.ts:enableSync` calls `getSyncQueue().populateFromExistingTasks()`, which writes sync queue entries. It logs through the `SYNC_CONFIG` logger.
- `disable.ts:disableSync` writes `syncMetadata`, then clears `syncQueue` and `syncHistory`. It reads the `sync_config` row inside that transaction. With no row it writes nothing to IndexedDB, and it still calls `clearPocketBase()` and `clearBrowserCaches()`. The queue and history stay, and no Trash delete is remembered.
- `disable.ts:disableSync` calls `clearPocketBase()`, which clears the PocketBase auth token and its localStorage entry.
- `disable.ts:clearBrowserCaches` calls `clearAppCaches()` from `lib/browser-cache.ts`. A failure there is logged as a warning and does not stop the sign-out.

## Verification

- Run: `bun run test`
