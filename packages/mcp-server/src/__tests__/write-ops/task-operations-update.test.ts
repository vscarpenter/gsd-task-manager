import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GsdConfig, Task } from '../../types.js';

const mocks = vi.hoisted(() => ({
  fetchSinglePBTaskFresh: vi.fn(),
  updateTaskInPBById: vi.fn().mockResolvedValue(undefined),
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
    getAuthInfo: mocks.getAuthInfo,
  };
});

vi.mock('../../tools/list-tasks.js', () => ({ listTasks: vi.fn() }));
vi.mock('../../cache.js', () => ({
  getTaskCache: () => ({ invalidate: mocks.invalidate }),
}));

import { listTasks } from '../../tools/list-tasks.js';
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
