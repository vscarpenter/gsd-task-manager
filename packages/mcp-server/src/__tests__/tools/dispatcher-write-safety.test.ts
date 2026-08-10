import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => ({
  deleteTask: vi.fn(),
  noop: vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'ok' }] })),
}));

vi.mock('../../tools/handlers/read-handlers.js', () => ({
  handleGetSyncStatus: handlers.noop,
  handleListDevices: handlers.noop,
  handleGetTaskStats: handlers.noop,
  handleListTasks: handlers.noop,
  handleGetTask: handlers.noop,
  handleSearchTasks: handlers.noop,
  handleGetTokenStatus: handlers.noop,
}));

vi.mock('../../tools/handlers/analytics-handlers.js', () => ({
  handleGetProductivityMetrics: handlers.noop,
  handleGetQuadrantAnalysis: handlers.noop,
  handleGetTagAnalytics: handlers.noop,
  handleGetUpcomingDeadlines: handlers.noop,
  handleGetTaskInsights: handlers.noop,
}));

vi.mock('../../tools/handlers/system-handlers.js', () => ({
  handleValidateConfig: handlers.noop,
  handleGetHelp: handlers.noop,
  handleGetCacheStats: handlers.noop,
}));

vi.mock('../../tools/handlers/write-handlers.js', () => ({
  handleCreateTask: handlers.noop,
  handleUpdateTask: handlers.noop,
  handleCompleteTask: handlers.noop,
  handleDeleteTask: handlers.deleteTask,
  handleBulkUpdateTasks: handlers.noop,
}));

import { handleToolCall } from '../../tools/handlers/index.js';

const config = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'token',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dispatcher write error safety', () => {
  it('replaces a PocketBase body with a stable status-derived code', async () => {
    handlers.deleteTask.mockRejectedValueOnce(Object.assign(
      new Error('422 title "Confidential acquisition" failed validation'),
      { status: 422 }
    ));

    const response = await handleToolCall('delete_task', { id: 'task-1', dryRun: false }, config);

    expect(response).toEqual({
      content: [{ type: 'text', text: 'Error: validation_failed' }],
      isError: true,
    });
    expect(JSON.stringify(response)).not.toContain('Confidential');
  });

  it('preserves safe dispatcher validation errors', async () => {
    const response = await handleToolCall('delete_task', { id: '' }, config);

    expect(response.isError).toBe(true);
    expect(response.content[0]?.text).toContain('Invalid arguments for delete_task');
  });
});
