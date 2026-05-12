import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GsdConfig, Task } from '../../types.js';

vi.mock('../../write-ops/helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../write-ops/helpers.js')>(
    '../../write-ops/helpers.js'
  );
  return {
    ...actual,
    getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
    fetchPBRecordIdsForTasks: vi.fn().mockResolvedValue(new Map()),
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
    const { listTasks } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasks).mockResolvedValueOnce([makeTask('t1')]);
    vi.mocked(helpers.fetchPBRecordIdsForTasks).mockResolvedValueOnce(
      new Map([['t1', 'pb-rec-1']])
    );

    const result = await bulkUpdateTasks(
      config,
      ['t1'],
      { type: 'delete' },
      { dryRun: false }
    );

    expect(result.dryRun).toBe(false);
    expect(result.deleted).toBe(1);
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

  it('does not apply the 10-cap to non-delete operations (50-cap still applies via schema)', async () => {
    const { listTasks } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const ids = Array.from({ length: 11 }, (_, i) => `t${i}`);
    const recordMap = new Map(ids.map((id) => [id, `rec-${id}`]));
    vi.mocked(listTasks).mockResolvedValueOnce(ids.map((id) => makeTask(id)));
    vi.mocked(helpers.fetchPBRecordIdsForTasks).mockResolvedValueOnce(recordMap);

    const result = await bulkUpdateTasks(
      config,
      ids,
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.dryRun).toBe(false);
    expect(result.updated).toBe(11);
  });
});
