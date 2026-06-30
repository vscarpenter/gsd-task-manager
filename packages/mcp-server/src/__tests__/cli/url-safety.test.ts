import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The CLI guards reuse the same URL policy as the server config. tools.js is
// mocked so the wizard/validator cannot perform real PocketBase calls if the
// guard ever regresses — the assertions below would catch the leak.
vi.mock('../../tools.js', () => ({
  getSyncStatus: vi.fn(),
  listDevices: vi.fn(),
  listTasks: vi.fn(),
}));

vi.mock('../../cli/index.js', () => ({
  prompt: vi.fn(() => Promise.resolve('http://api.attacker.example')),
  promptPassword: vi.fn(() => Promise.resolve('paste-token')),
  getClaudeConfigPath: vi.fn(() => '/tmp/claude_desktop_config.json'),
}));

vi.mock('../../cli/setup-artifact.js', () => ({
  getSetupArtifactPath: vi.fn(() => '/tmp/.gsd-mcp-setup.json'),
  removeSetupArtifact: vi.fn(),
}));

import { isSafePocketBaseUrl } from '../../server/config.js';
import { getSyncStatus } from '../../tools.js';
import { runValidation } from '../../cli/validation.js';
import { runSetupWizard } from '../../cli/setup-wizard.js';

describe('isSafePocketBaseUrl', () => {
  it('accepts https URLs', () => {
    expect(isSafePocketBaseUrl('https://api.example.com')).toBe(true);
  });

  it('accepts http loopback URLs', () => {
    expect(isSafePocketBaseUrl('http://127.0.0.1:8090')).toBe(true);
  });

  it('rejects plain http to a non-loopback host', () => {
    expect(isSafePocketBaseUrl('http://api.example.com')).toBe(false);
  });

  it('rejects the localhost-subdomain bypass', () => {
    expect(isSafePocketBaseUrl('http://localhost.attacker.com')).toBe(false);
  });

  it('rejects the userinfo bypass', () => {
    expect(isSafePocketBaseUrl('http://localhost@attacker.com')).toBe(false);
  });

  it('rejects unparseable input', () => {
    expect(isSafePocketBaseUrl('not a url')).toBe(false);
  });
});

describe('CLI URL safety guards', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy = vi.fn(() => Promise.resolve({ ok: true, status: 200 } as Response));
    vi.stubGlobal('fetch', fetchSpy);
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

  it('runValidation exits before any network I/O when the env URL is unsafe', async () => {
    process.env.GSD_POCKETBASE_URL = 'http://api.attacker.example';
    process.env.GSD_AUTH_TOKEN = 'secret-token';

    await expect(runValidation()).rejects.toThrow('process.exit:1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getSyncStatus).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('runSetupWizard exits before token-bearing calls when the prompted URL is unsafe', async () => {
    // prompt() is mocked to return an unsafe http://api.attacker.example URL.
    await expect(runSetupWizard()).rejects.toThrow('process.exit:1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getSyncStatus).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
