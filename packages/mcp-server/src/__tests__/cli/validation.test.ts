import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../tools.js', () => ({
  getSyncStatus: vi.fn(),
  listDevices: vi.fn(),
  listTasks: vi.fn(),
}));

import { runValidation } from '../../cli/validation.js';
import { getSyncStatus, listDevices, listTasks } from '../../tools.js';

describe('runValidation', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GSD_POCKETBASE_URL = 'https://pb.example.com';
    process.env.GSD_AUTH_TOKEN = 'token';
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GSD_POCKETBASE_URL;
    delete process.env.GSD_AUTH_TOKEN;
  });

  it('reports a fully healthy configuration', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    vi.mocked(getSyncStatus).mockResolvedValueOnce({
      healthy: true,
      taskCount: 3,
      lastSyncAt: null,
    });
    vi.mocked(listTasks).mockResolvedValueOnce([{}, {}] as never);
    vi.mocked(listDevices).mockResolvedValueOnce([
      { isActive: true },
      { isActive: false },
    ] as never);

    await expect(runValidation()).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('✅ Configuration is healthy! Your MCP server is ready to use.');
    expect(logSpy).toHaveBeenCalledWith('    Healthy (3 tasks synced)');
    expect(logSpy).toHaveBeenCalledWith('    2 total devices, 1 active');
  });

  it('reports warning-only connectivity, sync, and device results without exiting', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    vi.mocked(getSyncStatus).mockResolvedValueOnce({
      healthy: false,
      taskCount: 0,
      lastSyncAt: null,
    });
    vi.mocked(listTasks).mockResolvedValueOnce([]);
    vi.mocked(listDevices).mockRejectedValueOnce(new Error('unsupported'));

    await expect(runValidation()).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('⚠️  Configuration is functional but has warnings.');
    expect(logSpy).toHaveBeenCalledWith('    Connected but got status 503');
    expect(logSpy).toHaveBeenCalledWith('    PocketBase reports unhealthy status');
  });

  it('fails when connectivity, authentication, and task access fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    vi.mocked(getSyncStatus).mockRejectedValueOnce(new Error('bad token'));
    vi.mocked(listTasks).mockRejectedValueOnce(new Error('tasks unavailable'));
    vi.mocked(listDevices).mockResolvedValueOnce([]);

    await expect(runValidation()).rejects.toThrow('process.exit:1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy).toHaveBeenCalledWith('    Failed to connect to https://pb.example.com');
    expect(logSpy).toHaveBeenCalledWith('    bad token');
    expect(logSpy).toHaveBeenCalledWith('    tasks unavailable');
  });

  it('uses stable fallback messages for non-Error failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    vi.mocked(getSyncStatus).mockRejectedValueOnce('bad token');
    vi.mocked(listTasks).mockRejectedValueOnce('bad tasks');
    vi.mocked(listDevices).mockResolvedValueOnce([]);

    await expect(runValidation()).rejects.toThrow('process.exit:1');

    expect(logSpy).toHaveBeenCalledWith('    Token validation failed');
    expect(logSpy).toHaveBeenCalledWith('    Failed to read tasks');
  });

  it.each([
    ['GSD_POCKETBASE_URL', undefined, 'token'],
    ['GSD_AUTH_TOKEN', 'https://pb.example.com', undefined],
  ])('fails before network access when %s is missing', async (name, url, token) => {
    if (url === undefined) delete process.env.GSD_POCKETBASE_URL;
    else process.env.GSD_POCKETBASE_URL = url;
    if (token === undefined) delete process.env.GSD_AUTH_TOKEN;
    else process.env.GSD_AUTH_TOKEN = token;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(runValidation()).rejects.toThrow('process.exit:1');

    expect(logSpy).toHaveBeenCalledWith(`  - ${name}`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
