import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { chmodSync, writeFileSync } = vi.hoisted(() => ({
  chmodSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({ chmodSync, writeFileSync }));

vi.mock('../../tools.js', () => ({
  getSyncStatus: vi.fn(),
  listTasks: vi.fn(),
}));

vi.mock('../../cli/index.js', () => ({
  prompt: vi.fn(),
  promptPassword: vi.fn(),
  getClaudeConfigPath: vi.fn(() => '/config/claude.json'),
}));

vi.mock('../../cli/setup-artifact.js', () => ({
  getSetupArtifactPath: vi.fn(() => '/private/setup.json'),
  removeSetupArtifact: vi.fn(),
}));

import { prompt, promptPassword } from '../../cli/index.js';
import { getSyncStatus, listTasks } from '../../tools.js';
import { removeSetupArtifact } from '../../cli/setup-artifact.js';
import { runSetupWizard } from '../../cli/setup-wizard.js';

describe('runSetupWizard', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    vi.mocked(prompt).mockResolvedValue('https://pb.example.com');
    vi.mocked(promptPassword).mockResolvedValue('secret-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('validates access and writes an owner-only redacted configuration artifact', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    vi.mocked(getSyncStatus).mockResolvedValueOnce({
      healthy: true,
      taskCount: 4,
      lastSyncAt: null,
    });
    vi.mocked(listTasks).mockResolvedValueOnce([{}, {}] as never);

    await expect(runSetupWizard()).resolves.toBeUndefined();

    expect(writeFileSync).toHaveBeenCalledOnce();
    const [path, contents, options] = writeFileSync.mock.calls[0]!;
    expect(path).toBe('/private/setup.json');
    expect(JSON.parse(String(contents))).toMatchObject({
      mcpServers: { 'gsd-tasks': { env: { GSD_AUTH_TOKEN: 'secret-token' } } },
    });
    expect(options).toEqual({ mode: 0o600 });
    expect(chmodSync).toHaveBeenCalledWith('/private/setup.json', 0o600);
    expect(logSpy.mock.calls.flat().join('\n')).not.toContain('secret-token');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('continues after connectivity and task-list warnings and handles a short token preview', async () => {
    vi.mocked(promptPassword).mockResolvedValueOnce('tiny');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    vi.mocked(getSyncStatus).mockResolvedValueOnce({
      healthy: true,
      taskCount: 0,
      lastSyncAt: null,
    });
    vi.mocked(listTasks).mockRejectedValueOnce(new Error('not synced'));

    await expect(runSetupWizard()).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith('✗ Failed to connect');
    expect(logSpy).toHaveBeenCalledWith('⚠ Could not list tasks');
    expect(writeFileSync).toHaveBeenCalledOnce();
  });

  it('reports a non-OK health response but continues setup', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    vi.mocked(getSyncStatus).mockResolvedValueOnce({
      healthy: true,
      taskCount: 0,
      lastSyncAt: null,
    });
    vi.mocked(listTasks).mockRejectedValueOnce('not synced');

    await expect(runSetupWizard()).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith('⚠ Warning: Got status 503');
    expect(logSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
  });

  it('cleans up and exits when the token is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    vi.mocked(promptPassword).mockResolvedValueOnce('');

    await expect(runSetupWizard()).rejects.toThrow('process.exit:1');

    expect(removeSetupArtifact).toHaveBeenCalledTimes(2);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('cleans up and exits when token validation throws a non-Error value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    vi.mocked(getSyncStatus).mockRejectedValueOnce('bad token');

    await expect(runSetupWizard()).rejects.toThrow('process.exit:1');

    expect(logSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
    expect(removeSetupArtifact).toHaveBeenCalledTimes(2);
  });
});
