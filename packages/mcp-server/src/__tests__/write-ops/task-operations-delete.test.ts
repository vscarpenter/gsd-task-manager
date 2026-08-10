import { describe, expect, it, vi, beforeEach } from 'vitest';
import { taskToPBFields, type GsdConfig, type Task } from '../../types.js';

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }));

vi.mock('../../utils/logger.js', () => ({
  createMcpLogger: () => ({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../tools/list-tasks.js', () => ({
  listTasks: vi.fn(),
  listTasksFresh: vi.fn(),
}));

vi.mock('../../write-ops/helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../write-ops/helpers.js')>(
    '../../write-ops/helpers.js'
  );
  return {
    ...actual,
    getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
    deleteTaskInPBById: vi.fn().mockResolvedValue(undefined),
    updateTaskInPB: vi.fn().mockResolvedValue(undefined),
    fetchSinglePBTaskFresh: vi.fn().mockResolvedValue(null),
    updateTaskDependenciesInPBById: vi.fn().mockResolvedValue(undefined),
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

function freshTask(task: Task, timestamp = task.updatedAt) {
  return {
    pbRecordId: `record-${task.id}`,
    clientUpdatedAt: timestamp,
    record: {
      id: `record-${task.id}`,
      ...taskToPBFields(task, 'owner-1', 'device-1'),
      created: task.createdAt,
      updated: timestamp,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteTask', () => {
  it('rejects a task that no longer exists', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    vi.mocked(listTasksFresh).mockResolvedValueOnce([]);

    await expect(deleteTask(config, 'missing')).rejects.toThrow(/Task not found/);
  });

  it('previews deletion by default when dryRun is omitted', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasksFresh).mockResolvedValueOnce([
      makeTask('blocker'),
      makeTask('dependent', ['blocker']),
    ]);
    const result = await deleteTask(config, 'blocker');

    expect(result.dryRun).toBe(true);
    expect(result.taskId).toBe('blocker');
    expect(result.affectedTasks).toEqual(['task dependent']);
    expect(result.dependenciesCleaned).toBe(1);
    expect(helpers.deleteTaskInPBById).not.toHaveBeenCalled();
    expect(helpers.updateTaskInPB).not.toHaveBeenCalled();
  });

  it('deletes only when dryRun is explicitly false', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasksFresh).mockResolvedValueOnce([
      makeTask('blocker'),
      makeTask('dependent', ['blocker']),
    ]);
    const dependent = makeTask('dependent', ['blocker']);
    vi.mocked(helpers.fetchSinglePBTaskFresh)
      .mockResolvedValueOnce(freshTask(dependent))
      .mockResolvedValueOnce(freshTask(makeTask('blocker')))
      .mockResolvedValueOnce(freshTask(dependent));

    const result = await deleteTask(config, 'blocker', { dryRun: false });

    expect(result.dryRun).toBe(false);
    expect(result.dependenciesCleaned).toBe(1);
    expect(helpers.deleteTaskInPBById).toHaveBeenCalledWith(config, 'record-blocker');
    expect(helpers.updateTaskDependenciesInPBById).toHaveBeenCalledWith(
      config,
      'record-dependent',
      [],
      expect.any(String),
      'device-1'
    );
  });

  it('deletes without auth hydration when no dependencies need cleanup', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const standalone = makeTask('standalone');
    vi.mocked(listTasksFresh).mockResolvedValueOnce([standalone]);
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValueOnce(freshTask(standalone));

    const result = await deleteTask(config, 'standalone', { dryRun: false });

    expect(result.dependenciesCleaned).toBe(0);
    expect(helpers.getAuthInfo).not.toHaveBeenCalled();
  });

  it('should_log_cleanup_failures_via_structured_logger_without_echoing_pb_error_message', async () => {
    // PB 422 bodies echo submitted field values (task titles). A failed
    // dependency-cleanup write must go through the masking MCP logger with
    // content-free context (task id + status) — never raw console.error,
    // which would land the title in Claude Desktop's stderr log.
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(listTasksFresh).mockResolvedValueOnce([
      makeTask('blocker'),
      makeTask('dependent', ['blocker']),
    ]);
    const pbError = Object.assign(
      new Error('422: title "Confidential: acquire MegaCorp" failed to validate'),
      { status: 422 }
    );
    const dependent = makeTask('dependent', ['blocker']);
    vi.mocked(helpers.fetchSinglePBTaskFresh)
      .mockResolvedValueOnce(freshTask(dependent))
      .mockResolvedValueOnce(freshTask(makeTask('blocker')))
      .mockResolvedValueOnce(freshTask(dependent));
    vi.mocked(helpers.updateTaskDependenciesInPBById).mockRejectedValueOnce(pbError);

    const result = await deleteTask(config, 'blocker', { dryRun: false });

    expect(result.dryRun).toBe(false);
    expect(result.dependenciesCleaned).toBe(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn.mock.calls[0][1]).toMatchObject({
      taskId: 'dependent',
      status: 422,
    });
    expect(JSON.stringify(mockLoggerWarn.mock.calls)).not.toContain('Confidential');
    expect(result.partial).toBe(true);
    expect(result.errors).toEqual(['Task dependent: validation_failed']);
    expect(JSON.stringify(result)).not.toContain('Confidential');
  });

  it('reports a conflict instead of overwriting a dependent changed after the delete snapshot', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const dependent = makeTask('dependent', ['blocker']);
    vi.mocked(listTasksFresh).mockResolvedValueOnce([makeTask('blocker'), dependent]);
    vi.mocked(helpers.fetchSinglePBTaskFresh)
      .mockResolvedValueOnce(freshTask(dependent, '2026-04-01T00:00:00Z'))
      .mockResolvedValueOnce(freshTask(makeTask('blocker')))
      .mockResolvedValueOnce(freshTask(dependent, '2026-04-02T00:00:00Z'));

    const result = await deleteTask(config, 'blocker', { dryRun: false });

    expect(result.partial).toBe(true);
    expect(result.conflicts).toEqual(['dependent']);
    expect(result.dependenciesCleaned).toBe(0);
    expect(helpers.updateTaskDependenciesInPBById).not.toHaveBeenCalled();
  });

  it('deletes the primary task but reports a stable partial failure when a snapshot read fails', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    vi.mocked(listTasksFresh).mockResolvedValueOnce([
      makeTask('blocker'),
      makeTask('dependent', ['blocker']),
    ]);
    vi.mocked(helpers.fetchSinglePBTaskFresh)
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce(freshTask(makeTask('blocker')));

    const result = await deleteTask(config, 'blocker', { dryRun: false });

    expect(helpers.deleteTaskInPBById).toHaveBeenCalledWith(config, 'record-blocker');
    expect(helpers.updateTaskDependenciesInPBById).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      partial: true,
      dependenciesCleaned: 0,
      errors: ['Task dependent: authentication_failed'],
      conflicts: [],
    });
  });

  it('builds the cleanup patch from a fresh dependent instead of cached content', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const cached = makeTask('dependent', ['blocker', 'cached-dependency']);
    const fresh = { ...cached, title: 'Fresh title', dependencies: ['blocker', 'fresh-dependency'] };
    vi.mocked(listTasksFresh).mockResolvedValueOnce([makeTask('blocker'), cached]);
    vi.mocked(helpers.fetchSinglePBTaskFresh)
      .mockResolvedValueOnce(freshTask(fresh))
      .mockResolvedValueOnce(freshTask(makeTask('blocker')))
      .mockResolvedValueOnce(freshTask(fresh));

    await deleteTask(config, 'blocker', { dryRun: false });

    expect(helpers.updateTaskDependenciesInPBById).toHaveBeenCalledWith(
      config,
      'record-dependent',
      ['fresh-dependency'],
      expect.any(String),
      'device-1'
    );
  });

  it('discovers a dependent from the fresh PocketBase list even when the read cache omits it', async () => {
    const { listTasks, listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const dependent = makeTask('new-dependent', ['blocker']);
    vi.mocked(listTasks).mockResolvedValueOnce([makeTask('blocker')]);
    vi.mocked(listTasksFresh).mockResolvedValueOnce([makeTask('blocker'), dependent]);
    vi.mocked(helpers.fetchSinglePBTaskFresh)
      .mockResolvedValueOnce(freshTask(dependent))
      .mockResolvedValueOnce(freshTask(makeTask('blocker')))
      .mockResolvedValueOnce(freshTask(dependent));

    const result = await deleteTask(config, 'blocker', { dryRun: false });

    expect(listTasks).not.toHaveBeenCalled();
    expect(result.affectedTasks).toEqual(['task new-dependent']);
    expect(result.dependenciesCleaned).toBe(1);
  });

  it('honors one bounded 429 retry for a primary delete preflight', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const standalone = makeTask('standalone');
    vi.mocked(listTasksFresh).mockResolvedValueOnce([standalone]);
    vi.mocked(helpers.fetchSinglePBTaskFresh)
      .mockRejectedValueOnce({ status: 429, response: { retryAfterMs: 0 } })
      .mockResolvedValueOnce(freshTask(standalone));

    const result = await deleteTask(config, 'standalone', { dryRun: false });

    expect(result.partial).toBe(false);
    expect(helpers.fetchSinglePBTaskFresh).toHaveBeenCalledTimes(2);
    expect(helpers.deleteTaskInPBById).toHaveBeenCalledWith(config, 'record-standalone');
  });

  it('refuses to delete a primary task changed after the fresh list snapshot', async () => {
    const { listTasksFresh } = await import('../../tools/list-tasks.js');
    const helpers = await import('../../write-ops/helpers.js');
    const standalone = makeTask('standalone');
    vi.mocked(listTasksFresh).mockResolvedValueOnce([standalone]);
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValueOnce(
      freshTask(standalone, '2026-04-02T00:00:00Z')
    );

    await expect(deleteTask(config, 'standalone', { dryRun: false }))
      .rejects.toMatchObject({ name: 'ConflictError', taskId: 'standalone' });
    expect(helpers.deleteTaskInPBById).not.toHaveBeenCalled();
  });
});
