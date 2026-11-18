import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  deleteTask: vi.fn(),
  bulkUpdateTasks: vi.fn(),
}));

vi.mock('../../write-ops.js', () => mocks);

import { handleBulkUpdateTasks, handleDeleteTask, handleUpdateTask } from '../../tools/handlers/write-handlers.js';

const config = {
  pocketBaseUrl: 'http://example.invalid',
  authToken: 'token',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('write handler transcript safety', () => {
  it.each([true, false])('reports recurring instances and warnings for updates with dryRun=%s', async (dryRun) => {
    mocks.updateTask.mockResolvedValueOnce({
      dryRun,
      task: { id: 'original' },
      recurringInstance: { id: 'next-instance', dueDate: '2026-11-19T12:00:00.000Z' },
      changes: ['Completed'],
      validation: { valid: true, warnings: ['Due date is in the past'] },
    });

    const response = await handleUpdateTask(config, { id: 'original', completed: true, dryRun });

    expect(response.content[0]?.text).toContain(dryRun ? 'would be created' : 'Next recurring instance created');
    expect(response.content[0]?.text).toContain('next-instance');
    expect(response.content[0]?.text).toContain('2026-11-19T12:00:00.000Z');
    expect(response.content[0]?.text).toContain('Due date is in the past');
  });

  it('flags an incomplete single-delete cleanup as an error', async () => {
    mocks.deleteTask.mockResolvedValueOnce({
      dryRun: false, taskId: 'blocker', taskTitle: 'Blocker', partial: true,
      affectedTasks: ['Dependent'], dependenciesCleaned: 0, conflicts: ['dependent'], errors: [],
    });

    const response = await handleDeleteTask(config, { id: 'blocker', dryRun: false });

    expect(response.isError).toBe(true);
    expect(response.content[0]?.text).toContain('dependency cleanup is incomplete');
    expect(response.content[0]?.text).toContain('Conflicts: dependent');
  });

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

  it.each([
    ['delete', { type: 'delete' as const }],
    ['complete', { type: 'complete' as const, completed: true }],
  ])('tells the caller to set dryRun to false after a bulk %s preview', async (_name, operation) => {
    // Omitting dryRun stays a preview for bulk delete, so "remove dryRun" misleads.
    mocks.bulkUpdateTasks.mockResolvedValueOnce({
      updated: 0,
      deleted: 0,
      errors: [],
      conflicts: [],
      dryRun: true,
    });

    const response = await handleBulkUpdateTasks(config, { taskIds: ['t1'], operation });
    const text = response.content[0]?.text ?? '';

    expect(text).toContain('set dryRun to false');
    expect(text).not.toContain('remove dryRun');
  });
});
