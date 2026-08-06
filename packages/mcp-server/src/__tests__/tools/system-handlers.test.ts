import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpToolResponse } from '../../tools/handlers/types.js';

const mocks = vi.hoisted(() => ({
  healthCheck: vi.fn(),
  getSyncStatus: vi.fn(),
  listTasks: vi.fn(),
}));

vi.mock('../../pocketbase-client.js', () => ({
  getPocketBase: () => ({ health: { check: mocks.healthCheck } }),
}));

vi.mock('../../tools.js', () => ({
  getSyncStatus: mocks.getSyncStatus,
  listTasks: mocks.listTasks,
}));

vi.mock('../../cache.js', () => ({
  getTaskCache: () => ({ getStats: () => ({}) }),
}));

import { handleValidateConfig } from '../../tools/handlers/system-handlers.js';

const privateConfig = {
  pocketBaseUrl: 'https://user:secret@private.internal:8443/pb?token=hidden#fragment',
  authToken: 'auth-token',
};

function responseText(response: McpToolResponse): string {
  const block = response.content[0];
  if (!block || block.type !== 'text') throw new Error('Expected an MCP text response');
  return block.text;
}

describe('handleValidateConfig', () => {
  beforeEach(() => {
    mocks.healthCheck.mockReset().mockResolvedValue({});
    mocks.getSyncStatus.mockReset().mockResolvedValue({ taskCount: 2 });
    mocks.listTasks.mockReset().mockResolvedValue([{ id: 'task-1' }]);
  });

  it('redacts the configured PocketBase endpoint from successful diagnostics', async () => {
    const text = responseText(await handleValidateConfig(privateConfig));

    expect(text).toContain('[pocketbase-host]');
    expect(text).not.toContain('private.internal');
    expect(text).not.toContain('user:secret');
    expect(text).not.toContain('token=hidden');
  });

  it('does not echo raw backend errors containing the private endpoint', async () => {
    const rawError = `request to ${privateConfig.pocketBaseUrl} failed`;
    mocks.healthCheck.mockRejectedValueOnce(new Error(rawError));
    mocks.getSyncStatus.mockRejectedValueOnce(new Error(rawError));
    mocks.listTasks.mockRejectedValueOnce(new Error(rawError));

    const text = responseText(await handleValidateConfig(privateConfig));

    expect(text).not.toContain(rawError);
    expect(text).not.toContain('private.internal');
    expect(text).not.toContain('user:secret');
    expect(text).not.toContain('token=hidden');
  });
});
