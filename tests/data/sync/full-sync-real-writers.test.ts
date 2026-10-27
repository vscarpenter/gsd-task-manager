/**
 * A successful fullSync commits its outcome through the session fence
 * (writeSyncOutcome) with the real RetryManager and sync-history writers,
 * against fake-indexeddb. The engine unit suites mock those writers, so this
 * is the test that catches a non-Dexie await added inside them, which would
 * commit the fence transaction early and break every successful sync.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getDb } from '@/lib/db';
import type { PBSyncConfig } from '@/lib/sync/types';

const { mockGetList } = vi.hoisted(() => ({ mockGetList: vi.fn() }));

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
  notifySyncSuccess: vi.fn(),
  notifySyncError: vi.fn(),
}));

import { fullSync } from '@/lib/sync/pb-sync-engine';

// Earlier failures make RetryManager.recordSuccess write, not skip.
const SIGNED_IN_AFTER_FAILURES: PBSyncConfig = {
  key: 'sync_config',
  enabled: true,
  userId: 'user-1',
  deviceId: 'device-1',
  deviceName: 'Test device',
  email: 'one@example.com',
  provider: 'google',
  lastSyncAt: null,
  lastClientUpdatedAt: null,
  pullCursorVersion: SYNC_CONFIG.PULL_CURSOR_VERSION,
  lastServerUpdatedAt: null,
  lastSuccessfulSyncAt: null,
  consecutiveFailures: 2,
  lastFailureAt: Date.parse('2026-09-10T00:00:00.000Z'),
  lastFailureReason: 'network_error',
  nextRetryAt: Date.parse('2026-09-10T00:00:05.000Z'),
  localTaskOwnerUserId: 'user-1',
};

describe('fullSync with the real outcome writers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetList.mockReset();
    mockGetList.mockResolvedValue([]);
    const db = getDb();
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.syncMetadata.put(SIGNED_IN_AFTER_FAILURES);
  });

  it('should_commit_success_outcome_through_the_session_fence_with_real_writers', async () => {
    const result = await fullSync('auto');

    const db = getDb();
    const config = (await db.syncMetadata.get('sync_config')) as PBSyncConfig | undefined;
    expect(result.status).toBe('success');
    await expect(db.syncHistory.count()).resolves.toBe(1);
    expect(config?.consecutiveFailures).toBe(0);
  });
});

describe('fullSync pull contract upgrade', () => {
  const stamp = '2026-10-26T23:29:40.274Z';
  // The server copy, saved on another device while this client ran a build
  // that did not read saved_at.
  const savedOnServer = {
    id: 'rec-saved',
    collectionId: 'tasks',
    collectionName: 'tasks',
    created: '2026-10-26 23:29:42.288Z',
    updated: '2026-10-26 23:29:42.288Z',
    task_id: 't-saved',
    title: 'Read later',
    description: '',
    urgent: false,
    important: true,
    quadrant: 'not-urgent-important',
    completed: false,
    saved_at: stamp,
    client_updated_at: stamp,
    client_created_at: stamp,
    device_id: 'other-device',
    owner: 'user-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetList.mockReset();
    mockGetList.mockResolvedValue([savedOnServer]);
    const db = getDb();
    await Promise.all(db.tables.map((table) => table.clear()));
    // What the old build stored: the same version, without the field.
    await db.tasks.add({
      id: 't-saved',
      title: 'Read later',
      description: '',
      urgent: false,
      important: true,
      quadrant: 'not-urgent-important',
      completed: false,
      createdAt: stamp,
      updatedAt: stamp,
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
      notificationSent: false,
      timeSpent: 0,
      timeEntries: [],
    });
    // Its cursor already sits past the record, under the previous contract.
    await db.syncMetadata.put({
      ...SIGNED_IN_AFTER_FAILURES,
      lastClientUpdatedAt: '2026-10-27T00:00:00.000Z',
      pullCursorVersion: SYNC_CONFIG.PULL_CURSOR_VERSION - 1,
    });
  });

  it('pulls everything once and merges same-version rows when the config predates the contract', async () => {
    const result = await fullSync('auto');

    expect(result.status).toBe('success');
    expect(mockGetList.mock.calls[0][2].filter).toBe('owner = "user-1"');
    await expect(getDb().tasks.get('t-saved')).resolves.toMatchObject({ savedAt: stamp });
    await expect(getDb().syncMetadata.get('sync_config')).resolves.toMatchObject({ pullCursorVersion: SYNC_CONFIG.PULL_CURSOR_VERSION });
  });

  it('returns to incremental pulls once the contract is stamped', async () => {
    await fullSync('auto');
    mockGetList.mockClear();

    await fullSync('auto');

    expect(mockGetList.mock.calls[0][2].filter).toContain('client_updated_at >= "');
  });
});
