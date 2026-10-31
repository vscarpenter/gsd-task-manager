import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GsdConfig, Task } from '../../types.js';

const mocks = vi.hoisted(() => ({
  fetchSinglePBTaskFresh: vi.fn(),
  updateTaskInPBById: vi.fn().mockResolvedValue(undefined),
  createTaskInPB: vi.fn().mockResolvedValue(undefined),
  getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
  invalidate: vi.fn(),
}));

vi.mock('../../write-ops/helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../write-ops/helpers.js')>(
    '../../write-ops/helpers.js'
  );
  return {
    ...actual,
    fetchSinglePBTaskFresh: mocks.fetchSinglePBTaskFresh,
    updateTaskInPBById: mocks.updateTaskInPBById,
    createTaskInPB: mocks.createTaskInPB,
    getAuthInfo: mocks.getAuthInfo,
  };
});

vi.mock('../../tools/list-tasks.js', () => ({ listTasks: vi.fn(), listTasksFresh: vi.fn() }));
vi.mock('../../cache.js', () => ({
  getTaskCache: () => ({ invalidate: mocks.invalidate }),
}));

import { listTasksFresh as listTasks } from '../../tools/list-tasks.js';
import { completeTask, updateTask } from '../../write-ops/task-operations.js';

const config = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'fake',
} as GsdConfig;

function task(id: string, overrides: Partial<Task> = {}): Task {
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
    notificationEnabled: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function freshRecord(local: Task, timestamp = local.updatedAt) {
  return {
    pbRecordId: `record-${local.id}`,
    clientUpdatedAt: timestamp,
    record: {
      id: `record-${local.id}`,
      task_id: local.id,
      owner: 'owner-1',
      title: local.title,
      description: local.description,
      urgent: local.urgent,
      important: local.important,
      quadrant: local.quadrant,
      due_date: local.dueDate ?? '',
      completed: local.completed,
      completed_at: local.completedAt ?? '',
      recurrence: local.recurrence,
      tags: local.tags,
      subtasks: local.subtasks,
      dependencies: local.dependencies,
      notification_enabled: local.notificationEnabled ?? true,
      notify_before: local.notifyBefore ?? 0,
      notification_sent: false,
      last_notification_at: '',
      snoozed_until: '',
      saved_at: local.savedAt ?? '',
      estimated_minutes: local.estimatedMinutes ?? 0,
      time_spent: 0,
      time_entries: [],
      client_updated_at: timestamp,
      client_created_at: local.createdAt,
      device_id: 'device-2',
      created: local.createdAt,
      updated: timestamp,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTasks).mockResolvedValue([]);
});

describe('updateTask', () => {
  it('requires an explicit return before completing a saved item', async () => {
    mocks.fetchSinglePBTaskFresh.mockResolvedValueOnce(freshRecord(task('saved-reading', { savedAt: '2026-10-26T12:00:00.000Z' })));
    await expect(completeTask(config, 'saved-reading', true)).rejects.toThrow(/Return this saved item/);
    expect(mocks.updateTaskInPBById).not.toHaveBeenCalled();
  });

  it('rejects a task missing from the initial fresh read', async () => {
    mocks.fetchSinglePBTaskFresh.mockResolvedValueOnce(null);

    await expect(updateTask(config, { id: 'missing', title: 'new' })).rejects.toThrow(
      /Task not found/
    );
  });

  it('validates dependency edits against the current task graph', async () => {
    const current = task('target');
    mocks.fetchSinglePBTaskFresh.mockResolvedValueOnce(freshRecord(current));
    vi.mocked(listTasks).mockResolvedValueOnce([current]);

    await expect(
      updateTask(config, { id: 'target', dependencies: ['missing'], dryRun: true })
    ).rejects.toThrow(/Dependency tasks not found/);
  });

  it('builds a complete dry-run preview with warnings and ordered change labels', async () => {
    const current = task('target');
    const dependency = task('dependency');
    mocks.fetchSinglePBTaskFresh.mockResolvedValueOnce(freshRecord(current));
    vi.mocked(listTasks).mockResolvedValueOnce([current, dependency]);

    const result = await updateTask(config, {
      id: 'target',
      title: 'Renamed',
      description: 'Details',
      urgent: true,
      important: false,
      dueDate: '2020-01-01T00:00:00.000Z',
      tags: ['work'],
      subtasks: [{ id: 'sub-1', title: 'Step', completed: false }],
      recurrence: 'weekly',
      dependencies: ['dependency'],
      completed: true,
      notifyBefore: 15,
      notificationEnabled: false,
      estimatedMinutes: 30,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.validation.warnings).toEqual(['Due date is in the past']);
    expect(result.task).toMatchObject({
      title: 'Renamed',
      description: 'Details',
      quadrant: 'urgent-not-important',
      completed: true,
      dueDate: '2020-01-01T00:00:00.000Z',
      tags: ['work'],
      dependencies: ['dependency'],
      notifyBefore: 15,
      notificationEnabled: false,
      estimatedMinutes: 30,
    });
    expect(result.task.completedAt).toBeDefined();
    expect(result.changes).toEqual([
      'title: "task target" → "Renamed"',
      'description: updated',
      'urgent: false → true',
      'completed: false → true',
      'dueDate: none → 2020-01-01T00:00:00.000Z',
      'tags: updated',
      'dependencies: updated',
      'quadrant: not-urgent-not-important → urgent-not-important',
    ]);
    expect(mocks.updateTaskInPBById).not.toHaveBeenCalled();
  });

  it('clears due and completion timestamps when requested', async () => {
    const current = task('target', {
      completed: true,
      completedAt: '2026-04-01T01:00:00.000Z',
      dueDate: '2026-05-01T00:00:00.000Z',
    });
    mocks.fetchSinglePBTaskFresh.mockResolvedValueOnce(freshRecord(current));

    const result = await updateTask(config, {
      id: 'target',
      dueDate: '',
      completed: false,
      dryRun: true,
    });

    expect(result.task.dueDate).toBeUndefined();
    expect(result.task.completedAt).toBeUndefined();
  });

  it('persists only after an unchanged fresh preflight and invalidates once', async () => {
    const current = task('target');
    const fresh = freshRecord(current);
    mocks.fetchSinglePBTaskFresh.mockResolvedValueOnce(fresh).mockResolvedValueOnce(fresh);

    const result = await updateTask(config, { id: 'target', title: 'Saved' });

    expect(result.dryRun).toBe(false);
    expect(mocks.updateTaskInPBById).toHaveBeenCalledWith(
      config,
      'record-target',
      expect.objectContaining({ title: 'Saved' }),
      'owner-1',
      'device-1'
    );
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(mocks.getAuthInfo.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetchSinglePBTaskFresh.mock.invocationCallOrder[1]
    );
  });

  it('completeTask delegates completion and dry-run options through updateTask', async () => {
    const current = task('target');
    mocks.fetchSinglePBTaskFresh.mockResolvedValueOnce(freshRecord(current));

    const result = await completeTask(config, 'target', true, { dryRun: true });

    expect(result.task.completed).toBe(true);
    expect(result.dryRun).toBe(true);
  });
});

describe('completeTask with a recurring task', () => {
  // Mirrors toggleCompleted in lib/tasks/crud/toggle.ts: completing a recurring
  // task spawns the next instance. Dates are mid-day and clear of DST changes,
  // because the web rule advances them in local time.
  function recurring(recurrence: Task['recurrence'], dueDate?: string, extra: Partial<Task> = {}): Task {
    return task('series', {
      recurrence,
      ...(dueDate ? { dueDate } : {}),
      tags: ['home'],
      subtasks: [{ id: 'st-1', title: 'Step', completed: true }],
      notificationSent: true,
      lastNotificationAt: '2026-06-10T11:00:00.000Z',
      snoozedUntil: '2026-06-10T13:00:00.000Z',
      ...extra,
    });
  }

  async function complete(current: Task, options?: { dryRun?: boolean }) {
    const fresh = freshRecord(current);
    // freshRecord hard-codes the notification fields; give the series real values.
    Object.assign(fresh.record, {
      notification_sent: true,
      last_notification_at: '2026-06-10T11:00:00.000Z',
      snoozed_until: '2026-06-10T13:00:00.000Z',
    });
    mocks.fetchSinglePBTaskFresh.mockResolvedValue(fresh);
    return completeTask(config, current.id, true, options);
  }

  it.each([
    ['daily', '2026-06-10T12:00:00.000Z', '2026-06-11T12:00:00.000Z'],
    ['weekly', '2026-06-10T12:00:00.000Z', '2026-06-17T12:00:00.000Z'],
    ['monthly', '2026-06-10T12:00:00.000Z', '2026-07-10T12:00:00.000Z'],
    // The web uses setMonth, which overflows: Jan 31 plus a month is Mar 3.
    ['monthly', '2026-01-31T12:00:00.000Z', '2026-03-03T12:00:00.000Z'],
  ] as const)('creates the next %s instance due %s -> %s', async (recurrence, due, next) => {
    const result = await complete(recurring(recurrence, due));

    expect(mocks.createTaskInPB).toHaveBeenCalledTimes(1);
    const created = mocks.createTaskInPB.mock.calls[0][1] as Task;
    expect(created.dueDate).toBe(next);
    expect(result.recurringInstance?.id).toBe(created.id);
  });

  it('resets the instance the way the web does and keeps the series fields', async () => {
    const original = recurring('daily', '2026-06-10T12:00:00.000Z');
    await complete(original);

    const created = mocks.createTaskInPB.mock.calls[0][1] as Task;
    expect(created.id).not.toBe(original.id);
    expect(created).toMatchObject({
      title: original.title,
      recurrence: 'daily',
      tags: ['home'],
      completed: false,
      notificationSent: false,
      quadrant: original.quadrant,
    });
    expect(created.completedAt).toBeUndefined();
    expect(created.lastNotificationAt).toBeUndefined();
    expect(created.snoozedUntil).toBeUndefined();
    expect(created.subtasks).toEqual([{ id: 'st-1', title: 'Step', completed: false }]);
    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('keeps an undated recurring instance undated', async () => {
    await complete(recurring('weekly'));

    expect((mocks.createTaskInPB.mock.calls[0][1] as Task).dueDate).toBeUndefined();
  });

  it('creates nothing for a one-off task', async () => {
    const result = await complete(task('once'));

    expect(mocks.createTaskInPB).not.toHaveBeenCalled();
    expect(result.recurringInstance).toBeUndefined();
  });

  it('creates nothing when marking a recurring task incomplete', async () => {
    mocks.fetchSinglePBTaskFresh.mockResolvedValue(
      freshRecord(recurring('daily', '2026-06-10T12:00:00.000Z', { completed: true }))
    );

    await completeTask(config, 'series', false);

    expect(mocks.createTaskInPB).not.toHaveBeenCalled();
  });

  it('creates nothing when the task was already complete', async () => {
    await complete(recurring('daily', '2026-06-10T12:00:00.000Z', { completed: true }));

    expect(mocks.createTaskInPB).not.toHaveBeenCalled();
  });

  it('previews the next instance on a dry run without saving anything', async () => {
    const result = await complete(recurring('daily', '2026-06-10T12:00:00.000Z'), { dryRun: true });

    expect(result.recurringInstance?.dueDate).toBe('2026-06-11T12:00:00.000Z');
    expect(mocks.createTaskInPB).not.toHaveBeenCalled();
    expect(mocks.updateTaskInPBById).not.toHaveBeenCalled();
  });

  it('says so when the task completed but the next instance could not be created', async () => {
    mocks.createTaskInPB.mockRejectedValueOnce(new Error('network down'));

    await expect(complete(recurring('daily', '2026-06-10T12:00:00.000Z'))).rejects.toThrow(
      /marked complete, but the next recurring instance could not be created/
    );
    expect(mocks.updateTaskInPBById).toHaveBeenCalledTimes(1);
  });
});
