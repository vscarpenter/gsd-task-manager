import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { GsdConfig } from '../../types.js';

// Mock retry so we can throw and inspect the error message.
vi.mock('../../api/retry.js', async () => {
  const actual = await vi.importActual<typeof import('../../api/retry.js')>(
    '../../api/retry.js'
  );
  return {
    ...actual,
    fetchWithRetry: vi.fn(),
  };
});

import { apiRequest, redactPocketBaseHost } from '../../api/client.js';
import { fetchWithRetry } from '../../api/retry.js';

const schema = z.object({ ok: z.boolean() });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('redactPocketBaseHost', () => {
  it('redacts the hostname from an https URL', () => {
    expect(redactPocketBaseHost('https://api.vinny.io')).toBe(
      'https://[pocketbase-host]'
    );
  });

  it('redacts the hostname and port from an http URL', () => {
    expect(redactPocketBaseHost('http://localhost:8090')).toBe(
      'http://[pocketbase-host]'
    );
  });

  it('returns a stable placeholder if the URL is unparseable', () => {
    expect(redactPocketBaseHost('not a url')).toBe('[pocketbase-host]');
  });
});

describe('apiRequest error messages', () => {
  it('redacts the PocketBase host in network-error messages', async () => {
    vi.mocked(fetchWithRetry).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const config: GsdConfig = {
      pocketBaseUrl: 'https://api.vinny.io',
      authToken: 'fake',
    } as GsdConfig;

    await expect(apiRequest(config, '/api/health', schema)).rejects.toThrow(
      /\[pocketbase-host\]/
    );
    await expect(apiRequest(config, '/api/health', schema)).rejects.not.toThrow(
      /api\.vinny\.io/
    );
  });

  it('redacts the PocketBase host in non-2xx error messages', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    } as Response);

    const config: GsdConfig = {
      pocketBaseUrl: 'https://api.vinny.io',
      authToken: 'fake',
    } as GsdConfig;

    // The endpoint path is fine to leak — only the host is sensitive.
    const error = await apiRequest(config, '/api/collections/tasks/records', schema).catch(
      (e: Error) => e
    );
    expect((error as Error).message).not.toContain('api.vinny.io');
  });
});
