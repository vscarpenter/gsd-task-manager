import { getDb } from "@/lib/db";
import { getBackgroundSyncManager } from "@/lib/sync/background-sync";
import { getSyncConfig } from "@/lib/sync/config";
import { getSyncQueue } from "@/lib/sync/queue";
import type { TaskRecord } from "@/lib/types";

export type SyncOperation = "create" | "update" | "delete";
export type TransactionalSyncEnqueue = (
  operation: SyncOperation,
  taskId: string,
  data: TaskRecord | null
) => Promise<void>;
export interface TaskSyncTransactionContext {
  syncEnabled: boolean;
  enqueue: TransactionalSyncEnqueue;
}

/**
 * Schedule debounced background sync after task change
 * Only triggers if auto-sync is enabled and running
 */
export function scheduleSyncAfterChange(): void {
  const bgSyncManager = getBackgroundSyncManager();
  if (bgSyncManager.isRunning()) {
    bgSyncManager.scheduleDebouncedSync();
  }
}

/**
 * Get sync configuration and device ID
 * Returns 'local' as deviceId if not configured
 */
export async function getSyncContext(): Promise<{
  syncConfig: Awaited<ReturnType<typeof getSyncConfig>>;
  deviceId: string;
}> {
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || "local";
  return { syncConfig, deviceId };
}

/**
 * Enqueue a sync operation if sync is enabled
 */
export async function enqueueSyncOperation(
  operation: SyncOperation,
  taskId: string,
  data: import("@/lib/types").TaskRecord | null,
  syncEnabled: boolean
): Promise<void> {
  if (!syncEnabled) return;

  const queue = getSyncQueue();
  await queue.enqueue(operation, taskId, data);
  scheduleSyncAfterChange();
}

/**
 * Commit task-table changes and their sync-queue records as one unit.
 * Background sync is scheduled only after IndexedDB commits successfully.
 */
export async function runTaskSyncTransaction<T>(
  mutation: (context: TaskSyncTransactionContext) => Promise<T>
): Promise<T> {
  const db = getDb();
  const syncConfig = await getSyncConfig();
  const syncEnabled = syncConfig?.enabled ?? false;
  const queue = getSyncQueue();
  let didEnqueue = false;

  const enqueue: TransactionalSyncEnqueue = async (operation, taskId, data) => {
    if (!syncEnabled) return;
    await queue.enqueue(operation, taskId, data);
    didEnqueue = true;
  };

  const result = await db.transaction(
    "rw!",
    // `deletedTasks` is in scope for every task mutation because delete moves a
    // record into it and restore moves one out (ADR 0015); a narrower scope
    // would make those two operations non-atomic. `syncMetadata` is in scope so
    // a delete made while signed out remembers its id in the same commit.
    [db.tasks, db.deletedTasks, db.syncQueue, db.syncMetadata],
    // The scope must be an async function. Dexie keeps the transaction across
    // native awaits only for a scope tagged AsyncFunction; with a plain arrow, a
    // write after an await that made no request runs in a transaction of its own,
    // and Dexie rejects the commit as premature (WEB-UNDO-SIGNED-IN).
    async () => mutation({ syncEnabled, enqueue })
  );
  if (didEnqueue) scheduleSyncAfterChange();
  return result;
}
