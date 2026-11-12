# Sync Hooks

## Overview

This package holds three client React hooks that expose sync state to components. `useSync` and `useSyncStatus` read from the sync context that `lib/sync/sync-provider.tsx` provides. `useRetryCountdown` takes `nextRetryAt` as an argument and reads no context.

## Interface

- `use-sync.ts:useSync`. Re-export of `useSyncContext` from `lib/sync/sync-provider.tsx`.
- `use-sync.ts:UseSyncResult`. Type re-export of `SyncState` from `lib/sync/sync-provider.tsx`.
- `use-sync-status.ts:useSyncStatus(): SyncStatusResult`. Returns `isEnabled`, `retryCount`, `lastSyncTime`, `pendingCount`, `retryCountdown`, `error`, and `formatRelativeTime`.
- `use-retry-countdown.ts:useRetryCountdown(nextRetryAt: number | null): number | null`. Returns the seconds until the next sync retry, or `null` when none is scheduled.
- Related contract: [Sync](../sync/README.md).

## Invariants

- `use-sync-status.ts:useSyncStatus` reads nothing on its own. Its values come from the sync status store through the sync context.
- `use-sync-status.ts:useSyncStatus` returns `lastSyncTime` as `null` while sync is disabled.
- `use-retry-countdown.ts:useRetryCountdown` is shared by the header and the sync button, so both displays count down in step.
- `use-retry-countdown.ts:secondsUntil` returns `null` when `nextRetryAt` is unset or already past.

## Side Effects

- `use-retry-countdown.ts:useRetryCountdown` runs a `setInterval` every `SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS` (1 second) and clears it on cleanup.
- `use-sync-status.ts:useSyncStatus` runs a `setInterval` every `UI_TIMING.RELATIVE_TIME_REFRESH_MS` (30 seconds) to force a re-render, and clears it on cleanup.

## Verification

- Run: `bun run test`
