import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GsdConfig, Task } from '../../types.js';

vi.mock('../../tools/list-tasks.js', () => ({
  listTasks: vi.fn(),
}));

vi.mock('../../write-ops/helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../write-ops/helpers.js')>(
    '../../write-ops/helpers.js'
  );
  return {
    ...actual,
    getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
    deleteTaskInPB: vi.fn().mockResolvedValue(undefined),
    updateTaskInPB: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../cache.js', () => ({
  getTaskCache: () => ({ invalidate: vi.fn() }),
}));

import { deleteTask } from '../../write-ops/task-operations.js';

const config: GsdConfig = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'fake',
} as GsdConfig;

function makeTask(id: string, dependencies: string[] = []): Task {
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
    dependencies,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteTask', () => {
  it('previews deletion by default when dryRun is omitted', async () => {
    const { listTasks } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasks).mockResolvedValueOnce([
      makeTask('blocker'),
      makeTask('dependent', ['blocker']),
    ]);

    const result = await deleteTask(config, 'blocker');

    expect(result.dryRun).toBe(true);
    expect(result.taskId).toBe('blocker');
    expect(result.affectedTasks).toEqual(['task dependent']);
    expect(result.dependenciesCleaned).toBe(1);
    expect(helpers.deleteTaskInPB).not.toHaveBeenCalled();
    expect(helpers.updateTaskInPB).not.toHaveBeenCalled();
  });

  it('deletes only when dryRun is explicitly false', async () => {
    const { listTasks } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasks).mockResolvedValueOnce([
      makeTask('blocker'),
      makeTask('dependent', ['blocker']),
    ]);

    const result = await deleteTask(config, 'blocker', { dryRun: false });

    expect(result.dryRun).toBe(false);
    expect(result.dependenciesCleaned).toBe(1);
    expect(helpers.deleteTaskInPB).toHaveBeenCalledWith(config, 'blocker');
    expect(helpers.updateTaskInPB).toHaveBeenCalledTimes(1);
    expect(vi.mocked(helpers.updateTaskInPB).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        id: 'dependent',
        dependencies: [],
      })
    );
  });
});
