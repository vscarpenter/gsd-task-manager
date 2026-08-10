import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GsdConfig, Task } from '../../types.js';

const { mockBulkInfo } = vi.hoisted(() => ({ mockBulkInfo: vi.fn() }));

vi.mock('../../utils/logger.js', () => ({
  createMcpLogger: () => ({
    info: mockBulkInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

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
  it('returns an empty result without reading PocketBase', async () => {
    const helpers = await import('../../write-ops/helpers.js');

    await expect(
      bulkUpdateTasks(config, [], { type: 'complete', completed: true })
    ).resolves.toEqual({
      updated: 0,
      deleted: 0,
      errors: [],
      conflicts: [],
      dryRun: false,
    });
    expect(helpers.fetchPBSnapshotForTasks).not.toHaveBeenCalled();
  });

  it('caps every bulk operation at 50 task ids', async () => {
    const ids = Array.from({ length: 51 }, (_, index) => `t${index}`);

    await expect(
      bulkUpdateTasks(config, ids, { type: 'complete', completed: true })
    ).rejects.toThrow(/Maximum: 50/);
  });

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

  it('reports no matches in dry-run and write modes', async () => {
    const { listTasks } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasks).mockResolvedValueOnce([]);

    await expect(
      bulkUpdateTasks(config, ['missing'], { type: 'delete' })
    ).resolves.toMatchObject({ errors: ['No matching tasks found'], dryRun: true });

    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(new Map());
    await expect(
      bulkUpdateTasks(
        config,
        ['missing'],
        { type: 'complete', completed: true },
        { dryRun: false }
      )
    ).resolves.toMatchObject({ errors: ['No matching tasks found'], dryRun: false });
  });

  it('previews non-delete matches as updates', async () => {
    const { listTasks } = await import('../../tools/list-tasks.js');
    vi.mocked(listTasks).mockResolvedValueOnce([makeTask('t1')]);

    await expect(
      bulkUpdateTasks(
        config,
        ['t1'],
        { type: 'complete', completed: true },
        { dryRun: true }
      )
    ).resolves.toMatchObject({ updated: 1, deleted: 0, dryRun: true });
  });

  it('allows bounded batch work but serializes mutations through one write gate', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const ids = Array.from({ length: 12 }, (_, index) => `t${index}`);
    const snapshot = new Map(ids.map((id) => [id, makeSnapshotEntry(id)]));
    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(snapshot);

    let activePreflights = 0;
    let maxActivePreflights = 0;
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockImplementation(async (_config, id) => {
      activePreflights++;
      maxActivePreflights = Math.max(maxActivePreflights, activePreflights);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activePreflights--;
      return snapshot.get(id)!;
    });
    let activeMutations = 0;
    let maxActiveMutations = 0;
    vi.mocked(helpers.updateTaskInPBById).mockImplementation(async () => {
      activeMutations++;
      maxActiveMutations = Math.max(maxActiveMutations, activeMutations);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeMutations--;
    });

    const result = await bulkUpdateTasks(
      config,
      ids,
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.updated).toBe(12);
    expect(maxActivePreflights).toBeLessThanOrEqual(4);
    expect(maxActiveMutations).toBe(1);
  });

  it('keeps conflicts and errors in caller order under concurrent execution', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const ids = ['t1', 't2', 't3'];
    const snapshot = new Map(ids.map((id) => [id, makeSnapshotEntry(id)]));
    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(snapshot);
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockImplementation(async (_config, id) => {
      if (id === 't2') {
        return { ...snapshot.get(id)!, clientUpdatedAt: '2026-04-02T00:00:00Z' };
      }
      if (id === 't3') throw new Error('write failed');
      return snapshot.get(id)!;
    });

    const result = await bulkUpdateTasks(
      config,
      ids,
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.updated).toBe(1);
    expect(result.conflicts).toEqual(['t2']);
    expect(result.errors).toEqual(['Task t3: write_failed']);
  });

  it.each([
    [
      { type: 'move_quadrant', urgent: true, important: false } as const,
      { urgent: true, important: false, quadrant: 'urgent-not-important' },
    ],
    [{ type: 'add_tags', tags: ['work', 'work'] } as const, { tags: ['old', 'work'] }],
    [{ type: 'remove_tags', tags: ['old'] } as const, { tags: [] }],
    [
      { type: 'set_due_date', dueDate: '2026-05-01T00:00:00Z' } as const,
      { dueDate: '2026-05-01T00:00:00Z' },
    ],
    [{ type: 'set_due_date' } as const, { dueDate: undefined }],
    [{ type: 'complete', completed: false } as const, { completed: false, completedAt: undefined }],
  ])('applies operation %# without changing the response contract', async (operation, expected) => {
    const helpers = await import('../../write-ops/helpers.js');
    const snapshot = makeSnapshotEntry('t1');
    snapshot.record.tags = ['old'];
    snapshot.record.completed = true;
    snapshot.record.completed_at = '2026-04-01T01:00:00Z';
    snapshot.record.due_date = '2026-04-30T00:00:00Z';
    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(
      new Map([['t1', snapshot]])
    );
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValueOnce(snapshot);

    const result = await bulkUpdateTasks(config, ['t1'], operation, { dryRun: false });

    expect(result).toMatchObject({ updated: 1, errors: [], conflicts: [], dryRun: false });
    const updated = vi.mocked(helpers.updateTaskInPBById).mock.calls[0]?.[2] as Task;
    for (const [key, value] of Object.entries(expected)) {
      if (value === undefined) expect(updated).not.toHaveProperty(key);
      else expect(updated).toHaveProperty(key, value);
    }
  });

  it('retries a 429 once, pauses the write gate, and keeps result ordering stable', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const snapshot = makeSnapshotEntry('t1');
    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(
      new Map([['t1', snapshot]])
    );
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValue(snapshot);
    vi.mocked(helpers.updateTaskInPBById)
      .mockRejectedValueOnce({ status: 429, retryAfterMs: 1 })
      .mockResolvedValueOnce(undefined);

    const result = await bulkUpdateTasks(
      config,
      ['t1', 'missing'],
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.updated).toBe(1);
    expect(helpers.updateTaskInPBById).toHaveBeenCalledTimes(2);
    expect(result.errors).toEqual(['Task missing: not found in PocketBase']);
    expect(mockBulkInfo).toHaveBeenLastCalledWith(
      'Bulk write completed',
      expect.objectContaining({ rateLimitCount: 1, errorCount: 1 })
    );
  });

  it('never copies raw PocketBase response text into the result', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const snapshot = makeSnapshotEntry('t1');
    vi.mocked(helpers.fetchPBSnapshotForTasks).mockResolvedValueOnce(
      new Map([['t1', snapshot]])
    );
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValue(snapshot);
    const secret = 'Confidential: acquire MegaCorp';
    vi.mocked(helpers.updateTaskInPBById).mockRejectedValueOnce(
      Object.assign(new Error(`422 title "${secret}" invalid`), { status: 422 })
    );

    const result = await bulkUpdateTasks(
      config,
      ['t1'],
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.errors).toEqual(['Task t1: validation_failed']);
    expect(JSON.stringify(result)).not.toContain(secret);
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
