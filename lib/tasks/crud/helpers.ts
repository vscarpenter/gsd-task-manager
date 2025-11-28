import { getBackgroundSyncManager } from "@/lib/sync/background-sync";
import { getSyncConfig } from "@/lib/sync/config";
import { getSyncQueue } from "@/lib/sync/queue";
import { incrementVectorClock } from "@/lib/sync/vector-clock";
import type { VectorClock } from "@/lib/sync/types";

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
 * Returns null deviceId as 'local' if not configured
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
  vectorClock: VectorClock,
  syncEnabled: boolean
): Promise<void> {
  if (!syncEnabled) return;

  const queue = getSyncQueue();
  await queue.enqueue(operation, taskId, data, vectorClock);
  scheduleSyncAfterChange();
}

/**
 * Create a new vector clock for a new task
 */
export function createNewVectorClock(deviceId: string): VectorClock {
  return incrementVectorClock({}, deviceId);
}

/**
 * Increment an existing vector clock
 */
export function updateVectorClock(
  currentClock: VectorClock,
  deviceId: string
): VectorClock {
  return incrementVectorClock(currentClock, deviceId);
}
