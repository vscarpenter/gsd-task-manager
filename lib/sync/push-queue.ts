import { getDb } from '@/lib/db';
import { getSyncQueue } from './queue';
import { assertSyncSessionCurrent } from './sync-session';
import type { SyncQueueItem } from './types';

/** Consecutive upserts at one LWW version are snapshots of the same local edit. */
function equalVersionGroups(pending: SyncQueueItem[]): SyncQueueItem[][] {
  const groups: SyncQueueItem[][] = [];
  const byTask = new Map<string, SyncQueueItem[]>();
  for (const item of pending) {
    if (item.operation === 'delete' || !item.payload) {
      byTask.delete(item.taskId);
      continue;
    }
    const previous = byTask.get(item.taskId);
    if (previous?.[0].payload?.updatedAt === item.payload.updatedAt) {
      previous.push(item);
    } else {
      const group = [item];
      groups.push(group);
      byTask.set(item.taskId, group);
    }
  }
  return groups.filter((group) => group.length > 1);
}

/** Coalesce before CAS tie-breaking can make an older snapshot look newer. */
export async function preparePendingForSession(ownerId: string): Promise<SyncQueueItem[]> {
  const db = getDb();
  return db.transaction('rw', [db.syncMetadata, db.syncQueue, db.tasks], async () => {
    await assertSyncSessionCurrent(ownerId);
    const queue = getSyncQueue();
    const pending = await queue.getPending();
    const groups = equalVersionGroups(pending);
    if (groups.length === 0) return pending;
    const superseded = await Promise.all(groups.map(async (group) => {
      const latest = group[group.length - 1];
      const current = await db.tasks.get(latest.taskId);
      // Equal enqueue timestamps have no insertion order in IndexedDB. The
      // live row carries the final content when it still has this version.
      if (current?.updatedAt === latest.payload?.updatedAt) {
        await db.syncQueue.update(latest.id, { payload: current });
      }
      return group.slice(0, -1).map((item) => item.id);
    }));
    await queue.dequeueBulk(superseded.flat());
    return queue.getPending();
  });
}
