import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GsdConfig } from '../types.js';

import * as pbClient from '../pocketbase-client.js';

// listTasks is only invoked when input.dependencies is provided. We still mock
// it because the test path mustn't accidentally fall through to a real call.
vi.mock('../tools/list-tasks.js', () => ({
  listTasks: vi.fn(async () => []),
}));

import { updateTask, bulkUpdateTasks } from '../write-ops.js';
import { ConflictError } from '../errors.js';

const config: GsdConfig = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'fake',
} as unknown as GsdConfig;

function pbRecord(
  task_id: string,
  client_updated_at: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id: `rec-${task_id}`,
    task_id,
    owner: 'user-1',
    title: 'old',
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
    client_updated_at,
    client_created_at: '2026-05-18T08:00:00.000Z',
    device_id: 'dev-other',
    created: '2026-05-18T08:00:00.000Z',
    updated: '2026-05-18T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateTask conflict detection', () => {
  it('throws ConflictError when client_updated_at changes between read and preflight', async () => {
    const updateSpy = vi.fn();
    const getFirstListItem = vi
      .fn()
      // 1) initial fresh read
      .mockResolvedValueOnce(pbRecord('t1', '2026-05-18T08:00:00.000Z'))
      // 2) preflight check just before PUT — a concurrent writer bumped it
      .mockResolvedValueOnce(
        pbRecord('t1', '2026-05-18T09:30:00.000Z', { title: 'changed-by-other' })
      );

    vi.spyOn(pbClient, 'getPocketBase').mockReturnValue({
      collection: () => ({ getFirstListItem, update: updateSpy, create: vi.fn() }),
      authStore: {
        record: { id: 'user-1' },
        token: 'tok',
        isValid: true,
      },
    } as never);

    await expect(
      updateTask(config, { id: 't1', title: 'mine' } as never)
    ).rejects.toBeInstanceOf(ConflictError);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('writes through when client_updated_at is unchanged between read and preflight', async () => {
    const updateSpy = vi.fn(async () => ({ id: 'rec-t1' }));
    const stable = '2026-05-18T08:00:00.000Z';
    const getFirstListItem = vi
      .fn()
      .mockResolvedValueOnce(pbRecord('t1', stable))
      .mockResolvedValueOnce(pbRecord('t1', stable));

    vi.spyOn(pbClient, 'getPocketBase').mockReturnValue({
      collection: () => ({ getFirstListItem, update: updateSpy, create: vi.fn() }),
      authStore: {
        record: { id: 'user-1' },
        token: 'tok',
        isValid: true,
      },
    } as never);

    const result = await updateTask(config, {
      id: 't1',
      title: 'mine',
    } as never);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(result.task.title).toBe('mine');
  });

  it('throws when the task is deleted between read and preflight', async () => {
    const updateSpy = vi.fn();
    // Preflight returns a 404-shaped error -> fetchSinglePBTaskFresh returns null.
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    const getFirstListItem = vi
      .fn()
      .mockResolvedValueOnce(pbRecord('t1', '2026-05-18T08:00:00.000Z'))
      .mockRejectedValueOnce(notFound);

    vi.spyOn(pbClient, 'getPocketBase').mockReturnValue({
      collection: () => ({ getFirstListItem, update: updateSpy, create: vi.fn() }),
      authStore: {
        record: { id: 'user-1' },
        token: 'tok',
        isValid: true,
      },
    } as never);

    await expect(
      updateTask(config, { id: 't1', title: 'mine' } as never)
    ).rejects.toThrow(/deleted between read and write/);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('propagates non-404 errors instead of misreporting as deletion', async () => {
    const updateSpy = vi.fn();
    // 5xx error from PocketBase must propagate — otherwise the LLM would be
    // told the task was deleted and might try to recreate it.
    const serverErr = Object.assign(new Error('server boom'), { status: 503 });
    const getFirstListItem = vi
      .fn()
      .mockResolvedValueOnce(pbRecord('t1', '2026-05-18T08:00:00.000Z'))
      .mockRejectedValueOnce(serverErr);

    vi.spyOn(pbClient, 'getPocketBase').mockReturnValue({
      collection: () => ({ getFirstListItem, update: updateSpy, create: vi.fn() }),
      authStore: {
        record: { id: 'user-1' },
        token: 'tok',
        isValid: true,
      },
    } as never);

    await expect(
      updateTask(config, { id: 't1', title: 'mine' } as never)
    ).rejects.toThrow(/server boom/);

    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe('bulkUpdateTasks conflict detection', () => {
  it('skips conflicted tasks, applies the rest, and surfaces ids in result.conflicts', async () => {
    // Snapshot pre-fetch returns two tasks with timestamps T0a and T0b.
    // Preflight returns task A unchanged, but task B has changed.
    const snapshotA = pbRecord('a', '2026-05-18T08:00:00.000Z');
    const snapshotB = pbRecord('b', '2026-05-18T08:00:00.000Z');
    const preflightA = pbRecord('a', '2026-05-18T08:00:00.000Z');
    const preflightB = pbRecord('b', '2026-05-18T09:30:00.000Z', {
      title: 'changed-by-other',
    });

    const updateSpy = vi.fn(async (id: string) => ({ id }));

    // First call: snapshot batch fetch via getFullList
    // Subsequent calls: per-task preflight via getFirstListItem
    const getFullList = vi.fn().mockResolvedValueOnce([snapshotA, snapshotB]);

    // Preflight order matches iteration order over tasksToUpdate (a, b)
    const getFirstListItem = vi
      .fn()
      .mockResolvedValueOnce(preflightA)
      .mockResolvedValueOnce(preflightB);

    vi.spyOn(pbClient, 'getPocketBase').mockReturnValue({
      collection: () => ({
        getFullList,
        getFirstListItem,
        update: updateSpy,
        delete: vi.fn(),
        create: vi.fn(),
      }),
      authStore: {
        record: { id: 'user-1' },
        token: 'tok',
        isValid: true,
      },
    } as never);

    const result = await bulkUpdateTasks(
      config,
      ['a', 'b'],
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.updated).toBe(1);
    expect(result.conflicts).toEqual(['b']);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0]?.[0]).toBe('rec-a');
  });

  it('surfaces tasks that were deleted between snapshot and preflight as conflicts', async () => {
    // Snapshot pre-fetch returns both tasks (a, b). Preflight for `a` succeeds
    // (unchanged), preflight for `b` 404s — task was deleted on another device
    // between the snapshot fetch and the per-item preflight.
    const snapshotA = pbRecord('a', '2026-05-18T08:00:00.000Z');
    const snapshotB = pbRecord('b', '2026-05-18T08:00:00.000Z');
    const preflightA = pbRecord('a', '2026-05-18T08:00:00.000Z');
    const notFound = Object.assign(new Error('not found'), { status: 404 });

    const updateSpy = vi.fn(async (id: string) => ({ id }));
    const getFullList = vi.fn().mockResolvedValueOnce([snapshotA, snapshotB]);
    const getFirstListItem = vi
      .fn()
      .mockResolvedValueOnce(preflightA)
      .mockRejectedValueOnce(notFound);

    vi.spyOn(pbClient, 'getPocketBase').mockReturnValue({
      collection: () => ({
        getFullList,
        getFirstListItem,
        update: updateSpy,
        delete: vi.fn(),
        create: vi.fn(),
      }),
      authStore: {
        record: { id: 'user-1' },
        token: 'tok',
        isValid: true,
      },
    } as never);

    const result = await bulkUpdateTasks(
      config,
      ['a', 'b'],
      { type: 'complete', completed: true },
      { dryRun: false }
    );

    expect(result.updated).toBe(1);
    expect(result.conflicts).toEqual(['b']);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0]?.[0]).toBe('rec-a');
  });
});
