/**
 * Reset Everything while a sync is still in flight (AC9).
 *
 * Runs the real fullSync, pull, disableSync, and resetEverything against
 * fake-indexeddb. Only the network edge, auth refresh, push, toasts, health
 * monitor, and browser caches are mocked. tests/data/reset-everything.test.ts
 * mocks the database and sync config, so it cannot host this check.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordModel } from 'pocketbase';
import { getDb } from '@/lib/db';
import type { PBSyncConfig, PBSyncResult } from '@/lib/sync/types';

const { mockGetList, mockNotifySyncSuccess, mockNotifySyncError } = vi.hoisted(() => ({
  mockGetList: vi.fn(),
  mockNotifySyncSuccess: vi.fn(),
  mockNotifySyncError: vi.fn(),
}));

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: () => ({ collection: () => ({ getList: mockGetList }) }),
  getCurrentUserId: () => 'user-1',
  isAuthenticated: () => true,
  clearPocketBase: vi.fn(),
}));

vi.mock('@/lib/sync/pb-auth', () => ({
  ensureValidAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/sync/pb-push', () => ({
  pushLocalChanges: vi.fn().mockResolvedValue({
    pushedCount: 0,
    failedCount: 0,
    lastError: null,
    authenticated: true,
  }),
}));

vi.mock('@/lib/sync/notifications', () => ({
  notifySyncSuccess: mockNotifySyncSuccess,
  notifySyncError: mockNotifySyncError,
}));

vi.mock('@/lib/sync/health-monitor', () => ({
  getHealthMonitor: () => ({ isActive: () => false, stop: vi.fn() }),
}));

vi.mock('@/lib/browser-cache', () => ({
  clearAppCaches: vi.fn().mockResolvedValue([]),
}));

import { fullSync } from '@/lib/sync/pb-sync-engine';
import { resetEverything } from '@/lib/reset-everything';

const SIGNED_IN: PBSyncConfig = {
  key: 'sync_config',
  enabled: true,
  userId: 'user-1',
  deviceId: 'device-1',
  deviceName: 'Test device',
  email: 'one@example.com',
  provider: 'google',
  lastSyncAt: null,
  lastClientUpdatedAt: null,
  pullCursorVersion: 2,
  lastServerUpdatedAt: null,
  lastSuccessfulSyncAt: null,
  consecutiveFailures: 0,
  lastFailureAt: null,
  lastFailureReason: null,
  nextRetryAt: null,
  localTaskOwnerUserId: 'user-1',
};

function remoteTask(taskId: string): RecordModel {
  return {
    id: `rec-${taskId}`,
    collectionId: 'tasks',
    collectionName: 'tasks',
    created: '2026-09-10T00:00:00.000Z',
    updated: '2026-09-10T00:00:00.000Z',
    task_id: taskId,
    title: 'Task from the account that signed out',
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    client_updated_at: '2026-09-10T00:00:00.000Z',
    client_created_at: '2026-09-10T00:00:00.000Z',
    device_id: 'other-device',
    owner: 'user-1',
  } as unknown as RecordModel;
}

/** Start a sync, hold its pull fetch open, reset, then let the fetch land. */
async function runSyncThatOutlivesReset(): Promise<PBSyncResult> {
  const staleTask = remoteTask('outlived-reset');
  let releaseFetch!: (records: RecordModel[]) => void;
  mockGetList
    .mockImplementationOnce(() => new Promise<RecordModel[]>((resolve) => { releaseFetch = resolve; }))
    .mockResolvedValue([staleTask]);

  const sync = fullSync('auto');
  await vi.waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(1));
  await resetEverything();
  releaseFetch([staleTask]);
  return sync;
}

describe('resetEverything with a sync still in flight', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetList.mockReset();
    const db = getDb();
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.syncMetadata.put(SIGNED_IN);
  });

  it('should_keep_tasks_empty_when_in_flight_pull_resolves_after_reset', async () => {
    await runSyncThatOutlivesReset();

    const db = getDb();
    const config = (await db.syncMetadata.get('sync_config')) as PBSyncConfig | undefined;
    await expect(db.tasks.count()).resolves.toBe(0);
    expect(config?.enabled).toBe(false);
  });

  it('should_end_the_outlived_sync_as_cancelled_without_history_or_toast', async () => {
    const result = await runSyncThatOutlivesReset();

    expect(result).toEqual({ status: 'cancelled' });
    await expect(getDb().syncHistory.count()).resolves.toBe(0);
    expect(mockNotifySyncSuccess).not.toHaveBeenCalled();
    expect(mockNotifySyncError).not.toHaveBeenCalled();
  });
});
