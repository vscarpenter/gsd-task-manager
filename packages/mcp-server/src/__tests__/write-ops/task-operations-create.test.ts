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
    getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
  };
});

vi.mock('../../tools/list-tasks.js', () => ({
  listTasks: vi.fn().mockResolvedValue([]),
}));

import { createTask } from '../../write-ops/task-operations.js';

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
