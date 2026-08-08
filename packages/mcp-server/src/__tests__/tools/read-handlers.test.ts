import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../tools.js', () => ({
  getSyncStatus: vi.fn(async () => ({ status: 'healthy', taskCount: 3 })),
  listDevices: vi.fn(),
  getTaskStats: vi.fn(),
  listTasks: vi.fn(),
  getTask: vi.fn(),
  searchTasks: vi.fn(),
}));

vi.mock('../../pocketbase-client.js', () => ({
  getPocketBase: vi.fn(() => ({ authStore: { isValid: true } })),
}));

vi.mock('../../auth/token-status.js', () => ({
  getTokenStatus: vi.fn(() => ({ status: 'healthy', daysRemaining: 12 })),
}));

import {
  handleGetSyncStatus,
  handleGetTask,
  handleGetTaskStats,
  handleGetTokenStatus,
  handleListDevices,
  handleListTasks,
  handleSearchTasks,
} from '../../tools/handlers/read-handlers.js';
import {
  getTask,
  getTaskStats,
  listDevices,
  listTasks,
  searchTasks,
} from '../../tools.js';

const config = {
  pocketBaseUrl: 'https://private.internal',
  authToken: 'auth-token',
};

function responseJson(response: Awaited<ReturnType<typeof handleListTasks>>): unknown {
  return JSON.parse(response.content[0]?.text ?? 'null');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleGetSyncStatus', () => {
  it('redacts the configured PocketBase host from tool output', async () => {
    const response = await handleGetSyncStatus({
      pocketBaseUrl: 'https://user:password@private.internal:8443/pb?token=secret#fragment',
      authToken: 'auth-token',
    });
    const text = response.content[0]?.text ?? '';

    expect(text).toContain('https://[pocketbase-host]');
    expect(text).not.toContain('private.internal');
    expect(text).not.toContain('password');
    expect(text).not.toContain('secret');
  });
});

describe('read handlers', () => {
  it('returns token health', async () => {
    expect(responseJson(await handleGetTokenStatus(config))).toEqual({
      status: 'healthy',
      daysRemaining: 12,
    });
  });

  it('returns devices', async () => {
    vi.mocked(listDevices).mockResolvedValueOnce([{ id: 'device-1' }] as never);
    expect(responseJson(await handleListDevices(config))).toEqual([{ id: 'device-1' }]);
  });

  it('returns task statistics', async () => {
    vi.mocked(getTaskStats).mockResolvedValueOnce({ totalTasks: 3 } as never);
    expect(responseJson(await handleGetTaskStats(config))).toEqual({ totalTasks: 3 });
  });

  it('forwards list filters and returns tasks', async () => {
    const filters = { quadrant: 'urgent-important', completed: false, tags: ['work'] };
    vi.mocked(listTasks).mockResolvedValueOnce([{ id: 'task-1' }] as never);

    expect(responseJson(await handleListTasks(config, filters))).toEqual([{ id: 'task-1' }]);
    expect(listTasks).toHaveBeenCalledWith(config, filters);
  });

  it('forwards a task id and returns one task', async () => {
    vi.mocked(getTask).mockResolvedValueOnce({ id: 'task-1' } as never);

    expect(responseJson(await handleGetTask(config, { taskId: 'task-1' }))).toEqual({ id: 'task-1' });
    expect(getTask).toHaveBeenCalledWith(config, 'task-1');
  });

  it('forwards a query and returns search results', async () => {
    vi.mocked(searchTasks).mockResolvedValueOnce([{ id: 'task-2' }] as never);

    expect(responseJson(await handleSearchTasks(config, { query: 'report' }))).toEqual([{ id: 'task-2' }]);
    expect(searchTasks).toHaveBeenCalledWith(config, 'report');
  });
});
