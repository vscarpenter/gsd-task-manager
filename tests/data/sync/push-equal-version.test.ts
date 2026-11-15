import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getSyncQueue } from '@/lib/sync/queue';
import {
  fake, localRow, localTask, resetFakeSync, SAVED, seed, serverRow, signedIn,
} from './support/fake-pocketbase';

vi.mock('@/lib/sync/pocketbase-client', async () => {
  const { fake: server } = await import('./support/fake-pocketbase');
  return { getPocketBase: () => server.pb, getCurrentUserId: () => 'user-1', isAuthenticated: () => true };
});
vi.mock('@/lib/sync/pb-sync-helpers', async (original) => ({
  ...await original<typeof import('@/lib/sync/pb-sync-helpers')>(),
  THROTTLE_MS: 0,
}));

import { pushLocalChanges } from '@/lib/sync/pb-push';
import { pullRemoteChanges } from '@/lib/sync/pb-pull';

beforeEach(resetFakeSync);

describe('equal-version queued edits', () => {
  it.each([false, true])('keeps the newest edit after push and pull (existing remote: %s)', async (existing) => {
    const snapshots = ['First', 'Second', 'Latest'].map((title) => localRow(SAVED, { title }));
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [snapshots[2]],
      server: existing ? [serverRow()] : [] });
    for (const [index, snapshot] of snapshots.entries()) {
      await getDb().syncQueue.add({ id: `queued-${index}`, operation: 'update', taskId: snapshot.id,
        timestamp: index, retryCount: 0, status: 'pending', payload: snapshot });
    }

    await pushLocalChanges('user-1');
    await pullRemoteChanges('user-1');

    expect([...fake.state.records.values()][0].title).toBe('Latest');
    expect((await localTask())?.title).toBe('Latest');
    expect(await getSyncQueue().getPendingCount()).toBe(0);
    expect(fake.state.writes).toHaveLength(1);
  });

  it('retains the latest intent after failure and sends it on retry', async () => {
    const latest = localRow(SAVED, { title: 'Latest' });
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [latest],
      queued: [localRow(SAVED, { title: 'First' }), localRow(SAVED, { title: 'Second' }), latest],
      server: [serverRow()] });
    fake.state.failUpdate = true;

    expect((await pushLocalChanges('user-1')).failedCount).toBe(1);
    const remaining = await getSyncQueue().getPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payload?.title).toBe('Latest');
    fake.state.failUpdate = false;
    await pushLocalChanges('user-1');
    await pullRemoteChanges('user-1');
    expect((await localTask())?.title).toBe('Latest');
  });

  it('still accepts a genuinely newer remote edit', async () => {
    const snapshots = ['First', 'Second', 'Latest'].map((title) => localRow(SAVED, { title }));
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [snapshots[2]], queued: snapshots,
      server: [serverRow({ title: 'Another device', client_updated_at: '2026-10-21T10:00:00.000Z' })] });
    await pushLocalChanges('user-1');
    await pullRemoteChanges('user-1');
    expect(fake.state.writes).toHaveLength(0);
    expect((await localTask())?.title).toBe('Another device');
  });

  it('uses the current same-version row when enqueue timestamps also tie', async () => {
    const latest = localRow(SAVED, { title: 'Latest' });
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [latest], server: [serverRow()] });
    for (const [id, title] of [['a', 'Second'], ['b', 'Latest'], ['c', 'First']]) {
      await getDb().syncQueue.add({ id, operation: 'update', taskId: latest.id,
        timestamp: 1, retryCount: 0, status: 'pending', payload: localRow(SAVED, { title }) });
    }

    await pushLocalChanges('user-1');
    await pullRemoteChanges('user-1');

    expect((await localTask())?.title).toBe('Latest');
    expect([...fake.state.records.values()][0].title).toBe('Latest');
  });
});
