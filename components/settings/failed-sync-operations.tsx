"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import { getSessionOwner } from '@/lib/sync/sync-session';
import { recoverFailedSyncItem } from '@/lib/sync/failed-recovery';
import type { PBSyncConfig, SyncQueueItem } from '@/lib/sync/types';

async function readFailures() {
  const db = getDb();
  return db.transaction('r', [db.syncMetadata, db.syncQueue, db.tasks], async () => {
    const ownerId = getSessionOwner(await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined);
    if (!ownerId) return null;
    const rows = await getSyncQueue().getFailed();
    const tasks = await db.tasks.bulkGet(rows.map((row) => row.taskId));
    return { ownerId, rows: rows.map((row, index) => ({ ...row, label: tasks[index]?.title ?? row.payload?.title ?? 'Deleted task' })) };
  });
}

export function FailedSyncOperations() {
  const failures = useLiveQuery(readFailures, []);
  if (!failures?.rows.length) return null;
  return (
    <section aria-label="Failed sync operations" className="space-y-3 border-y border-border px-4 py-4">
      <h3 className="text-sm font-semibold">Failed sync operations</h3>
      <p className="text-xs text-foreground-muted">Retry sends the latest local task. Dismiss moves unsynced tasks to Trash and leaves the cloud copy alone.</p>
      <ul className="space-y-3">
        {failures.rows.map((row) => <FailureRow key={row.id} row={row} ownerId={failures.ownerId} />)}
      </ul>
    </section>
  );
}

function FailureRow({ row, ownerId }: { row: SyncQueueItem & { label: string }; ownerId: string }) {
  const [busy, setBusy] = useState(false);
  const recover = async (action: 'retry' | 'dismiss') => {
    setBusy(true);
    try {
      const result = await recoverFailedSyncItem(row.id, ownerId, action);
      toast.success(result === 'trashed' ? 'Unsynced task moved to Trash' : result === 'queued' ? 'Retry queued' : 'Failed operation cleared');
      if (result === 'queued') {
        const { getSyncCoordinator } = await import('@/lib/sync/sync-coordinator');
        void getSyncCoordinator().requestSync('user').catch(() => toast.error('Retry is queued. Try syncing again when connected.'));
      }
      setBusy(false);
    } catch {
      toast.error('Could not recover this operation. Check your sync account and try again.');
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words text-sm font-medium">{row.label}</p>
        <p className="break-words text-xs text-foreground-muted">{row.operation} · {row.lastError ?? 'Sync failed'} · {row.retryCount} attempts</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void recover('retry')} className="touch-target rounded border border-border px-3 py-2 text-sm disabled:opacity-50">Retry</button>
      <button type="button" disabled={busy} onClick={() => void recover('dismiss')} className="touch-target rounded border border-border px-3 py-2 text-sm disabled:opacity-50">Dismiss</button>
    </li>
  );
}
