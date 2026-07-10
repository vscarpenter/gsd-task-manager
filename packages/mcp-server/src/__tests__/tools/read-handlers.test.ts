import { describe, expect, it, vi } from 'vitest';

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

import { handleGetSyncStatus } from '../../tools/handlers/read-handlers.js';

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
