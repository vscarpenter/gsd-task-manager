import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GsdConfig } from '../../types.js';

// Mock the helpers so we never touch real PocketBase.
vi.mock('../../write-ops/helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../write-ops/helpers.js')>(
    '../../write-ops/helpers.js'
  );
  return {
    ...actual,
    createTaskInPB: vi.fn().mockResolvedValue(undefined),
    updateTaskInPB: vi.fn().mockResolvedValue(undefined),
    updateTaskInPBById: vi.fn().mockResolvedValue(undefined),
    fetchSinglePBTaskFresh: vi.fn().mockResolvedValue(null),
    getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
  };
});

vi.mock('../../tools/list-tasks.js', () => ({
  listTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../cache.js', () => ({
  getTaskCache: () => ({ invalidate: vi.fn() }),
}));

import { createTask, updateTask } from '../../write-ops/task-operations.js';

const config: GsdConfig = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'fake',
} as GsdConfig;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTask URL extraction', () => {
  it('extracts a single url from the title into the description', async () => {
    const result = await createTask(config, {
      title: 'Read https://example.com later',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Read later');
    expect(result.task.description).toBe('https://example.com/');
  });

  it('uses the fallback title when the title is url-only', async () => {
    const result = await createTask(config, {
      title: 'https://example.com',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Review link below');
    expect(result.task.description).toBe('https://example.com/');
  });

  it('appends the url below an existing description', async () => {
    const result = await createTask(config, {
      title: 'Read https://example.com later',
      description: 'Notes here',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Read later');
    expect(result.task.description).toBe('Notes here\nhttps://example.com/');
  });

  it('does not extract javascript protocol urls', async () => {
    const result = await createTask(config, {
      title: 'Bad javascript:alert(1) link',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Bad javascript:alert(1) link');
    expect(result.task.description).toBe('');
  });

  it('leaves a no-url title unchanged', async () => {
    const result = await createTask(config, {
      title: 'Plain task',
      description: 'Some notes',
      urgent: true,
      important: true,
      dryRun: true,
    });

    expect(result.task.title).toBe('Plain task');
    expect(result.task.description).toBe('Some notes');
    expect(result.task.urgent).toBe(true);
    expect(result.task.important).toBe(true);
  });

  it('returns the transformed task on dry run without persisting', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const result = await createTask(config, {
      title: 'Read https://example.com later',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.task.title).toBe('Read later');
    expect(helpers.createTaskInPB).not.toHaveBeenCalled();
  });
});

describe('updateTask URL parity', () => {
  it('does NOT extract URLs from title (mirrors webapp non-extraction on edit)', async () => {
    const helpers = await import('../../write-ops/helpers.js');

    // updateTask now reads the current task via fetchSinglePBTaskFresh (bypass
    // cache). Mock it with a PBTask shape (snake_case) that pbTaskToTask
    // translates into the same seed as before.
    const seedRecord = {
      id: 'rec-task-1',
      task_id: 'task-1',
      owner: 'owner-1',
      title: 'Original',
      description: 'Original description',
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
    } as never;
    vi.mocked(helpers.fetchSinglePBTaskFresh).mockResolvedValueOnce({
      pbRecordId: 'rec-task-1',
      clientUpdatedAt: '2026-04-01T00:00:00Z',
      record: seedRecord,
    });

    const result = await updateTask(config, {
      id: 'task-1',
      title: 'Read https://example.com later',
      dryRun: true,
    });

    // URL must remain in the title — updateTask intentionally skips extraction
    expect(result.task.title).toBe('Read https://example.com later');
    // Description must not be modified by URL extraction
    expect(result.task.description).toBe('Original description');
  });
});
