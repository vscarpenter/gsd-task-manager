import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GsdConfig, Task } from '../../types.js';

vi.mock('../../write-ops/helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../write-ops/helpers.js')>(
    '../../write-ops/helpers.js'
  );
  return {
    ...actual,
    getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
    // Snapshot-prefetch returns fresh PB records for the whole batch in one
    // request — bulk now sources task content from this instead of listTasks.
    fetchPBSnapshotForTasks: vi.fn().mockResolvedValue(new Map()),
    // Per-item preflight check just before each write.
    fetchSinglePBTaskFresh: vi.fn().mockResolvedValue(null),
    updateTaskInPBById: vi.fn().mockResolvedValue(undefined),
    deleteTaskInPBById: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../tools/list-tasks.js', () => ({
  listTasks: vi.fn(),
}));

vi.mock('../../cache.js', () => ({
  getTaskCache: () => ({ invalidate: vi.fn() }),
}));

import { bulkUpdateTasks } from '../../write-ops/bulk-operations.js';

const config: GsdConfig = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'fake',
} as GsdConfig;

function makeTask(id: string): Task {
  return {
    id,
    title: `task ${id}`,
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    tags: [],
    subtasks: [],
    recurrence: 'none',
    dependencies: [],
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };
}

/**
 * Build a PB snapshot entry for the write path. Bulk now reads task content
 * from PocketBase (cache bypassed) instead of `listTasks`, so write-path tests
 * mock `fetchPBSnapshotForTasks` with one of these entries per task.
 */
function makeSnapshotEntry(id: string) {
  return {
    pbRecordId: `rec-${id}`,
    clientUpdatedAt: '2026-04-01T00:00:00Z',
    record: {
      id: `rec-${id}`,
      task_id: id,
      owner: 'owner-1',
      title: `task ${id}`,
      description: '',
      urgent: false,
      important: false,
      quadrant: 'not-urgent-not-important',
      due_date: '',
      completed: false,
      completed_at: '',
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notification_enabled: true,
      notify_before: 0,
      notification_sent: false,
      last_notification_at: '',
      snoozed_until: '',
      estimated_minutes: 0,
      time_spent: 0,
      time_entries: [],
      client_updated_at: '2026-04-01T00:00:00Z',
      client_created_at: '2026-04-01T00:00:00Z',
      device_id: 'device-1',
      created: '2026-04-01T00:00:00Z',
      updated: '2026-04-01T00:00:00Z',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bulkUpdateTasks — delete safety', () => {
  it('defaults dryRun to true for delete operations when not specified', async () => {
    const { listTasks } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasks).mockResolvedValueOnce([makeTask('t1'), makeTask('t2')]);

    const result = await bulkUpdateTasks(config, ['t1', 't2'], { type: 'delete' });

    expect(result.dryRun).toBe(true);
    expect(result.deleted).toBe(2);
    expect(helpers.deleteTaskInPBById).not.toHaveBeenCalled();
  });

  it('actually deletes when dryRun is explicitly false', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const snapshot = makeSnapshotEntry('t1');
    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(
      new Map([['t1', snapshot]])
    );
    // Preflight returns the same client_updated_at as the snapshot — no conflict.
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValueOnce(snapshot);

    const result = await bulkUpdateTasks(
      config,
      ['t1'],
      { type: 'delete' },
      { dryRun: false }
    );

    expect(result.dryRun).toBe(false);
    expect(result.deleted).toBe(1);
    expect(result.conflicts).toEqual([]);
    expect(helpers.deleteTaskInPBById).toHaveBeenCalledTimes(1);
  });

  it('caps delete operations at 10 tasks per call', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `t${i}`);

    await expect(
      bulkUpdateTasks(config, ids, { type: 'delete' }, { dryRun: false })
    ).rejects.toThrow(/delete/i);
  });

  it('allows up to 10 deletes per call', async () => {
    const { listTasks } = await import('../../tools/list-tasks.js');
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    vi.mocked(listTasks).mockResolvedValueOnce(ids.map((id) => makeTask(id)));

    // dryRun stays true by default — proves the cap is not exceeded
    const result = await bulkUpdateTasks(config, ids, { type: 'delete' });
    expect(result.dryRun).toBe(true);
    expect(result.deleted).toBe(10);
  });

  it('should_stamp_each_updated_task_with_a_fresh_timestamp_not_one_batch_wide_time', async () => {
    // A throttled batch can span seconds. Each write must carry the time it was
    // actually applied, not the time the batch started — otherwise a later
    // item's stale timestamp can lose the next LWW round to a concurrent edit.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    try {
      const helpers = await import('../../write-ops/helpers.js');
      const ids = ['t1', 't2'];
      const snapshot = new Map(ids.map((id) => [id, makeSnapshotEntry(id)]));
      vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(snapshot);
      for (const id of ids) {
        vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValueOnce(snapshot.get(id)!);
      }
      // The throttle between writes advances wall-clock time, simulating a slow
      // batch where t2 is written a second after t1.
      vi.mocked(helpers.sleep).mockImplementationOnce(async () => {
        vi.advanceTimersByTime(1000);
      });

      const result = await bulkUpdateTasks(
        config,
        ids,
        { type: 'complete', completed: true },
        { dryRun: false }
      );

      expect(result.updated).toBe(2);
      const calls = vi.mocked(helpers.updateTaskInPBById).mock.calls;
      expect(calls).toHaveLength(2);
      const firstUpdatedAt = (calls[0][2] as Task).updatedAt;
      const secondUpdatedAt = (calls[1][2] as Task).updatedAt;
      expect(secondUpdatedAt).not.toBe(firstUpdatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not apply the 10-cap to non-delete operations (50-cap still applies via schema)', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const ids = Array.from({ length: 11 }, (_, i) => `t${i}`);
    const snapshot = new Map(ids.map((id) => [id, makeSnapshotEntry(id)]));
    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(snapshot);
    // Each task's preflight returns the same timestamp — no conflicts.
    for (const id of ids) {
      vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValueOnce(snapshot.get(id)!);
    }

    const result = await bulkUpdateTasks(
      config,
      ids,
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.dryRun).toBe(false);
    expect(result.updated).toBe(11);
    expect(result.conflicts).toEqual([]);
  });
});
