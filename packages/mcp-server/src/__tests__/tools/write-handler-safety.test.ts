import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  deleteTask: vi.fn(),
  bulkUpdateTasks: vi.fn(),
}));

vi.mock('../../write-ops.js', () => mocks);

import { handleBulkUpdateTasks } from '../../tools/handlers/write-handlers.js';

const config = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'token',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('write handler transcript safety', () => {
  it('marks bulk errors and conflicts as partial instead of successful', async () => {
    mocks.bulkUpdateTasks.mockResolvedValueOnce({
      updated: 1,
      deleted: 0,
      errors: ['Task t2: validation_failed'],
      conflicts: ['t3'],
      dryRun: false,
    });

    const response = await handleBulkUpdateTasks(config, {
      taskIds: ['t1', 't2', 't3'],
      operation: { type: 'complete', completed: true },
      dryRun: false,
    });

    expect(response.isError).toBe(true);
    expect(response.content[0]?.text).toContain('⚠️ Bulk operation partially completed.');
    expect(response.content[0]?.text).not.toContain('✅');
  });
});
