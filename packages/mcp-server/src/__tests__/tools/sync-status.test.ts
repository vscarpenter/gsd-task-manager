import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GsdConfig } from '../../types.js';

const getFullList = vi.fn();

vi.mock('../../pocketbase-client.js', () => ({
  getPocketBase: () => ({ collection: () => ({ getFullList }) }),
  requireUsersPrincipal: vi.fn(),
}));

import { getTaskStats } from '../../tools/sync-status.js';

const config = { pocketbaseUrl: 'http://example.invalid', authToken: 'fake' } as GsdConfig;

function record(overrides: Record<string, unknown>) {
  return {
    task_id: 'a',
    completed: false,
    saved_at: '',
    client_updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTaskStats', () => {
  it('leaves Saved tasks out of every count and timestamp', async () => {
    getFullList.mockResolvedValue([
      record({ task_id: 'active', client_updated_at: '2026-11-02T00:00:00.000Z' }),
      record({ task_id: 'done', completed: true, client_updated_at: '2026-11-03T00:00:00.000Z' }),
      record({
        task_id: 'saved',
        saved_at: '2026-10-30T00:00:00.000Z',
        client_updated_at: '2026-12-01T00:00:00.000Z',
      }),
    ]);

    const stats = await getTaskStats(config);

    expect(stats).toEqual({
      totalTasks: 2,
      activeTasks: 1,
      completedTasks: 1,
      lastUpdated: '2026-11-03T00:00:00.000Z',
      oldestTask: '2026-11-02T00:00:00.000Z',
      newestTask: '2026-11-03T00:00:00.000Z',
    });
  });

  it('asks PocketBase for saved_at so it can tell', async () => {
    getFullList.mockResolvedValue([]);

    await getTaskStats(config);

    expect(getFullList.mock.calls[0]?.[0].fields).toContain('saved_at');
  });
});
