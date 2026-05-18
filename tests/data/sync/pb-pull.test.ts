import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordModel } from 'pocketbase';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

vi.mock('@/lib/sync/pb-sync-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>('@/lib/sync/pb-sync-helpers');
  return {
    ...actual,
    fetchRemoteTaskIndex: vi.fn(async () => ({ index: new Map(), fetchSucceeded: true })),
    getCurrentUserId: vi.fn(() => 'user-1'),
  };
});

import { pullRemoteChanges } from '@/lib/sync/pb-pull';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

function pbRecord(taskId: string, clientUpdatedAt: string): RecordModel {
  return {
    id: `rec-${taskId}`,
    collectionId: 'tasks',
    collectionName: 'tasks',
    created: '2026-05-18T00:00:00.000Z',
    updated: '2026-05-18T00:00:00.000Z',
    task_id: taskId,
    title: 'T',
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    client_updated_at: clientUpdatedAt,
    client_created_at: '2026-05-18T00:00:00.000Z',
    device_id: 'other-device',
    owner: 'user-1',
  } as unknown as RecordModel;
}

describe('pullRemoteChanges cursor clamping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clamps year-3000 timestamps to now+5min when computing the cursor', async () => {
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => [pbRecord('t1', '3000-01-01T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    expect(maxObservedTimestamp).not.toBeNull();
    expect(new Date(maxObservedTimestamp!).getTime()).toBeLessThanOrEqual(fiveMinFromNow + 1000);
  });

  it('does not include invalid (un-applied) records in the cursor', async () => {
    const badRecord = pbRecord('t1', '2099-12-31T00:00:00.000Z');
    // Force `pocketBaseToTaskRecord` to reject by stripping a required field.
    delete (badRecord as Record<string, unknown>).title;

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => [badRecord, pbRecord('t2', '2026-05-18T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    // The applied record's client_updated_at is 2026-05-18T00:00:00Z; the cursor
    // is persisted with a 30s overlap subtracted so the next pull's `>=` filter
    // can re-catch boundary records reliably across clock drift.
    expect(maxObservedTimestamp).toBe('2026-05-17T23:59:30.000Z');
  });
});
