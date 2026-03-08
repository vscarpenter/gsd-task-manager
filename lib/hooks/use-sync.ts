"use client";

/**
 * useSync hook -- thin wrapper around the SyncProvider context.
 *
 * All sync lifecycle management (health monitor, background sync,
 * status polling) is handled by the single SyncProvider mounted
 * at the app level. This hook just reads from that context.
 */

export { useSyncContext as useSync } from '@/lib/sync/sync-provider';
export type { SyncState as UseSyncResult } from '@/lib/sync/sync-provider';
