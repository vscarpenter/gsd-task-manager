import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listTasks } from '../../tools/list-tasks.js';
import { resetTaskCache } from '../../cache.js';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../pocketbase-client.js', () => ({
  getPocketBase: () => ({ collection: () => ({ getFullList: mocks.fetch }) }),
}));

const config = { pocketBaseUrl: 'https://example.invalid', authToken: 'test-token' };

beforeEach(() => {
  resetTaskCache();
  mocks.fetch.mockReset();
  // Tags stored before MCP normalized them, or imported without normalizing.
  mocks.fetch.mockResolvedValue([
    { task_id: 'capital', title: 'Capital', tags: ['Work'] },
    { task_id: 'hashed', title: 'Hashed', tags: ['#work'] },
    { task_id: 'clean', title: 'Clean', tags: ['work'] },
    { task_id: 'other', title: 'Other', tags: ['home'] },
  ]);
});

describe('list_tasks tag filter against legacy stored tags', () => {
  it('matches a stored tag by its normalized form', async () => {
    const found = await listTasks(config, { tags: ['work'] });

    expect(found.map((task) => task.id).sort()).toEqual(['capital', 'clean', 'hashed']);
  });

  it('leaves tasks with other tags out', async () => {
    const found = await listTasks(config, { tags: ['home'] });

    expect(found.map((task) => task.id)).toEqual(['other']);
  });
});
