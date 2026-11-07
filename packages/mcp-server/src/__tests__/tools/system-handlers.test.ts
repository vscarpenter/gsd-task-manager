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

import { handleGetHelp, handleValidateConfig } from '../../tools/handlers/system-handlers.js';

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
    mocks.getSyncStatus.mockReset().mockResolvedValue({ healthy: true, taskCount: 2, lastSyncAt: null });
    mocks.listTasks.mockReset().mockResolvedValue([{ id: 'task-1' }]);
  });

  it('redacts the configured PocketBase endpoint from successful diagnostics', async () => {
    const text = responseText(await handleValidateConfig(privateConfig));

    expect(text).toContain('[pocketbase-host]');
    expect(text).not.toContain('private.internal');
    expect(text).not.toContain('user:secret');
    expect(text).not.toContain('token=hidden');
  });

  it('reports authentication success only when the sync status is healthy', async () => {
    mocks.getSyncStatus.mockResolvedValueOnce({ healthy: true, taskCount: 2, lastSyncAt: null });

    const { checks } = JSON.parse(responseText(await handleValidateConfig(privateConfig)));
    const auth = checks.find((check: { name: string }) => check.name === 'Authentication');

    expect(auth).toMatchObject({ status: 'success', details: 'Authenticated (2 tasks accessible)' });
  });

  it('reports an authentication error when getSyncStatus returns unhealthy instead of throwing', async () => {
    // getSyncStatus catches its own errors (bad or revoked token, unreachable
    // server) and returns healthy: false, so the check must read the result.
    mocks.getSyncStatus.mockResolvedValueOnce({ healthy: false, taskCount: 0, lastSyncAt: null });

    const { checks } = JSON.parse(responseText(await handleValidateConfig(privateConfig)));
    const auth = checks.find((check: { name: string }) => check.name === 'Authentication');

    expect(auth).toMatchObject({ status: 'error', details: 'Token validation failed' });
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

describe('handleGetHelp tool list', () => {
  it('counts 20 tools and does not mention list_devices', async () => {
    const text = responseText(await handleGetHelp({ topic: 'tools' }));

    expect(text).toContain('Available Tools (20 total)');
    expect(text).not.toContain('list_devices');
  });

  it('does not advertise a status filter list_tasks rejects', async () => {
    const text = responseText(await handleGetHelp({ topic: 'tools' }));

    expect(text).toContain('(quadrant, completed, tags)');
  });

  it('states the 10-per-delete bulk cap and that Saved items are hidden', async () => {
    const text = responseText(await handleGetHelp({ topic: 'tools' }));

    expect(text).toContain('(max 50, or 10 per delete)');
    expect(text).toContain('Saved items');
  });
});

describe('handleGetHelp setup advice', () => {
  it('recommends a pinned global install instead of npx', async () => {
    const text = responseText(await handleGetHelp({}));

    expect(text).toMatch(/npm install --global gsd-mcp-server@\d+\.\d+\.\d+/);
    expect(text).not.toContain('npx gsd-mcp-server');
  });
});
