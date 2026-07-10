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
    [db.tasks, db.syncQueue],
    () => mutation({ syncEnabled, enqueue })
  );
  if (didEnqueue) scheduleSyncAfterChange();
  return result;
}
