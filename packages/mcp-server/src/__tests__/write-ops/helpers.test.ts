import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GsdConfig, Task } from '../../types.js';

const mocks = vi.hoisted(() => {
  const tasks = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getFirstListItem: vi.fn(),
    getFullList: vi.fn(),
  };
  const users = { authRefresh: vi.fn() };
  const pb = {
    authStore: { token: 'token', record: { id: 'owner-1' } as { id: string } | null },
    collection: vi.fn((name: string) => (name === 'users' ? users : tasks)),
  };
  return {
    tasks,
    users,
    pb,
    getPocketBase: vi.fn(() => pb),
    invalidate: vi.fn(),
    taskToPBFields: vi.fn(() => ({ mapped: true })),
  };
});

vi.mock('../../pocketbase-client.js', () => ({
  getPocketBase: mocks.getPocketBase,
}));

vi.mock('../../cache.js', () => ({
  getTaskCache: () => ({ invalidate: mocks.invalidate }),
}));

vi.mock('../../types.js', async () => {
  const actual = await vi.importActual<typeof import('../../types.js')>('../../types.js');
  return { ...actual, taskToPBFields: mocks.taskToPBFields };
});

import {
  createTaskInPB,
  deleteTaskInPB,
  deleteTaskInPBById,
  deriveQuadrant,
  escapeFilterValue,
  fetchPBRecordIdsForTasks,
  fetchPBSnapshotForTasks,
  fetchSinglePBTaskFresh,
  generateTaskId,
  getAuthInfo,
  updateTaskInPB,
  updateTaskInPBById,
  updateTaskDependenciesInPBById,
} from '../../write-ops/helpers.js';

const config = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'token',
} as GsdConfig;

const task = {
  id: 'task-1',
  title: 'Task',
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
} satisfies Task;

function pbRecord(id = 'record-1', taskId = 'task-1') {
  return {
    id,
    task_id: taskId,
    client_updated_at: '2026-04-01T00:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pb.authStore.token = 'token';
  mocks.pb.authStore.record = { id: 'owner-1' };
  mocks.tasks.create.mockResolvedValue(pbRecord());
  mocks.tasks.update.mockResolvedValue(pbRecord());
  mocks.tasks.delete.mockResolvedValue(true);
  mocks.tasks.getFirstListItem.mockResolvedValue(pbRecord());
  mocks.tasks.getFullList.mockResolvedValue([]);
  mocks.users.authRefresh.mockResolvedValue({});
});

describe('filter and identity helpers', () => {
  it('escapes backslashes then double quotes so a value stays a single filter literal', () => {
    expect(escapeFilterValue('a"b\\c')).toBe('a\\"b\\\\c');
  });

  it('returns plain values unchanged and accepts the exact length limit', () => {
    expect(escapeFilterValue('task-123_abc')).toBe('task-123_abc');
    expect(() => escapeFilterValue('x'.repeat(500))).not.toThrow();
  });

  it('rejects a filter value above the maximum length', () => {
    expect(() => escapeFilterValue('x'.repeat(501))).toThrow(/length/i);
  });

  it('generates a compact UUID and derives every quadrant', () => {
    expect(generateTaskId()).toMatch(/^[a-f0-9]{32}$/);
    expect(deriveQuadrant(true, true)).toBe('urgent-important');
    expect(deriveQuadrant(false, true)).toBe('not-urgent-important');
    expect(deriveQuadrant(true, false)).toBe('urgent-not-important');
    expect(deriveQuadrant(false, false)).toBe('not-urgent-not-important');
  });
});

describe('PocketBase mutation helpers', () => {
  it('creates mapped fields and invalidates the task cache', async () => {
    await createTaskInPB(config, task, 'owner-1', 'device-1');

    expect(mocks.taskToPBFields).toHaveBeenCalledWith(task, 'owner-1', 'device-1');
    expect(mocks.tasks.create).toHaveBeenCalledWith({ mapped: true });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it('looks up, updates, and invalidates by client task id', async () => {
    await updateTaskInPB(config, { ...task, id: 'quote"id' }, 'owner-1', 'device-1');

    expect(mocks.tasks.getFirstListItem).toHaveBeenCalledWith('task_id = "quote\\"id"');
    expect(mocks.tasks.update).toHaveBeenCalledWith('record-1', { mapped: true });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it('deletes by client task id, maps only 404, and preserves retryable status errors', async () => {
    await deleteTaskInPB(config, 'task-1');
    expect(mocks.tasks.delete).toHaveBeenCalledWith('record-1');
    expect(mocks.invalidate).toHaveBeenCalledOnce();

    mocks.tasks.getFirstListItem.mockRejectedValueOnce({ status: 404 });
    await expect(deleteTaskInPB(config, 'missing')).rejects.toThrow(
      'Task not found in PocketBase: missing'
    );

    const rateLimited = { status: 429, response: { retryAfterMs: 2000 } };
    mocks.tasks.getFirstListItem.mockRejectedValueOnce(rateLimited);
    await expect(deleteTaskInPB(config, 'rate-limited')).rejects.toBe(rateLimited);
  });

  it('updates and deletes by known record id without invalidating the batch cache', async () => {
    await updateTaskInPBById(config, 'record-2', task, 'owner-1', 'device-1');
    await deleteTaskInPBById(config, 'record-2');

    expect(mocks.tasks.update).toHaveBeenCalledWith('record-2', { mapped: true });
    expect(mocks.tasks.delete).toHaveBeenCalledWith('record-2');
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it('patches only dependency metadata by known record id', async () => {
    await updateTaskDependenciesInPBById(
      config,
      'record-2',
      ['dependency-1'],
      '2026-08-10T15:00:00.000Z',
      'device-1'
    );

    expect(mocks.tasks.update).toHaveBeenCalledWith('record-2', {
      dependencies: ['dependency-1'],
      client_updated_at: '2026-08-10T15:00:00.000Z',
      device_id: 'device-1',
    });
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});

describe('fresh read helpers', () => {
  it('returns a fresh record snapshot', async () => {
    const result = await fetchSinglePBTaskFresh(config, 'task-1');

    expect(result).toEqual({
      pbRecordId: 'record-1',
      clientUpdatedAt: '2026-04-01T00:00:00Z',
      record: pbRecord(),
    });
  });

  it('returns null only for a true 404 and rethrows other failures', async () => {
    mocks.tasks.getFirstListItem.mockRejectedValueOnce({ status: 404 });
    await expect(fetchSinglePBTaskFresh(config, 'missing')).resolves.toBeNull();

    const unauthorized = { status: 401 };
    mocks.tasks.getFirstListItem.mockRejectedValueOnce(unauthorized);
    await expect(fetchSinglePBTaskFresh(config, 'private')).rejects.toBe(unauthorized);
  });

  it('fetches a batch snapshot in one escaped filter request', async () => {
    mocks.tasks.getFullList.mockResolvedValueOnce([
      pbRecord('record-1', 'task-1'),
      pbRecord('record-2', 'task-2'),
    ]);

    const result = await fetchPBSnapshotForTasks(config, ['task-1', 'task-2']);

    expect(mocks.tasks.getFullList).toHaveBeenCalledWith({
      filter: 'task_id = "task-1" || task_id = "task-2"',
    });
    expect(result.get('task-2')?.pbRecordId).toBe('record-2');
  });

  it('short-circuits empty snapshots and record-id batches', async () => {
    await expect(fetchPBSnapshotForTasks(config, [])).resolves.toEqual(new Map());
    await expect(fetchPBRecordIdsForTasks(config, [])).resolves.toEqual(new Map());
    expect(mocks.tasks.getFullList).not.toHaveBeenCalled();
  });

  it('fetches record ids with a minimal field projection', async () => {
    mocks.tasks.getFullList.mockResolvedValueOnce([
      pbRecord('record-1', 'task-1'),
      pbRecord('record-2', 'task-2'),
    ]);

    const result = await fetchPBRecordIdsForTasks(config, ['task-1', 'task-2']);

    expect(mocks.tasks.getFullList).toHaveBeenCalledWith({
      filter: 'task_id = "task-1" || task_id = "task-2"',
      fields: 'id,task_id,client_updated_at',
    });
    expect(result).toEqual(
      new Map([
        ['task-1', 'record-1'],
        ['task-2', 'record-2'],
      ])
    );
  });
});

describe('auth hydration', () => {
  it('uses an already hydrated owner record', async () => {
    await expect(getAuthInfo(config)).resolves.toEqual({
      ownerId: 'owner-1',
      deviceId: 'mcp-server',
    });
    expect(mocks.users.authRefresh).not.toHaveBeenCalled();
  });

  it('refreshes a token-only auth store before returning the owner', async () => {
    mocks.pb.authStore.record = null;
    mocks.users.authRefresh.mockImplementationOnce(async () => {
      mocks.pb.authStore.record = { id: 'owner-refreshed' };
      return {};
    });

    await expect(getAuthInfo(config)).resolves.toEqual({
      ownerId: 'owner-refreshed',
      deviceId: 'mcp-server',
    });
  });

  it('reports refresh failure without leaking the raw server response', async () => {
    mocks.pb.authStore.record = null;
    mocks.users.authRefresh.mockRejectedValueOnce(new Error('secret server body'));

    await expect(getAuthInfo(config)).rejects.toThrow(/Not authenticated/);
  });

  it('rejects an empty auth store', async () => {
    mocks.pb.authStore.record = null;
    mocks.pb.authStore.token = '';

    await expect(getAuthInfo(config)).rejects.toThrow(/Not authenticated/);
    expect(mocks.users.authRefresh).not.toHaveBeenCalled();
  });
});
