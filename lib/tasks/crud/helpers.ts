import { getBackgroundSyncManager } from "@/lib/sync/background-sync";
import { getSyncConfig } from "@/lib/sync/config";
import { getSyncQueue } from "@/lib/sync/queue";

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
  operation: "create" | "update" | "delete",
  taskId: string,
  data: import("@/lib/types").TaskRecord | null,
  syncEnabled: boolean
): Promise<void> {
  if (!syncEnabled) return;

  const queue = getSyncQueue();
  await queue.enqueue(operation, taskId, data);
  scheduleSyncAfterChange();
}
