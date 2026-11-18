import { afterEach, expect, it, vi } from 'vitest';
import { getTaskCache, resetTaskCache } from '../../cache.js';
import { listTasks } from '../../tools/list-tasks.js';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../pocketbase-client.js', () => ({
  getPocketBase: () => ({ collection: () => ({ getFullList: mocks.fetch }) }),
}));

afterEach(() => resetTaskCache());

it('does not cache a pre-cleanup snapshot that arrives after invalidation', async () => {
  const config = { pocketBaseUrl: 'https://example.invalid', authToken: 'test-token' };
  const stale = [{ task_id: 'dependent', title: 'Dependent', dependencies: ['blocker'] }];
  let finishRead!: (records: typeof stale) => void;
  mocks.fetch
    .mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve; }))
    .mockResolvedValueOnce([{ ...stale[0], dependencies: [] }]);

  const inFlight = listTasks(config);
  getTaskCache().invalidate();
  finishRead(stale);

  expect((await inFlight)[0].dependencies).toEqual(['blocker']);
  expect((await listTasks(config))[0].dependencies).toEqual([]);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
