import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const {
  loadConfigMock,
  removeSetupArtifactMock,
  assertNonSuperuserPrincipalMock,
  createGsdServerMock,
  loadGsdSkillsMock,
  serveStdioMock,
} = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
  removeSetupArtifactMock: vi.fn(),
  assertNonSuperuserPrincipalMock: vi.fn(),
  createGsdServerMock: vi.fn(),
  loadGsdSkillsMock: vi.fn(),
  serveStdioMock: vi.fn(),
}));

vi.mock('../../server/config.js', () => ({ loadConfig: loadConfigMock }));
vi.mock('../../cli/setup-artifact.js', () => ({ removeSetupArtifact: removeSetupArtifactMock }));
vi.mock('../../pocketbase-client.js', () => ({
  assertNonSuperuserPrincipal: assertNonSuperuserPrincipalMock,
}));
vi.mock('../../server/setup.js', () => ({ createGsdServer: createGsdServerMock }));
vi.mock('../../server/skills.js', () => ({ loadGsdSkills: loadGsdSkillsMock }));
vi.mock('@modelcontextprotocol/server/stdio', () => ({ serveStdio: serveStdioMock }));

import { SuperuserPrincipalError } from '../../errors.js';
import { prepareStartup, reportStartupFailure, startMcpServer } from '../../server/startup.js';

const config = { pocketBaseUrl: 'https://pb.example.com', authToken: 'token' };

describe('prepareStartup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadConfigMock.mockReturnValue(config);
  });

  it('reaches no network, so an unreachable backend cannot block startup', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(prepareStartup()).toBe(config);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('removes the setup artifact before the principal gate can refuse', () => {
    const order: string[] = [];
    removeSetupArtifactMock.mockImplementation(() => {
      order.push('artifact');
      return true;
    });
    assertNonSuperuserPrincipalMock.mockImplementation(() => {
      order.push('principal');
      throw new SuperuserPrincipalError();
    });

    expect(() => prepareStartup()).toThrow(SuperuserPrincipalError);
    // A refusal must never leave the plaintext token file on disk.
    expect(order).toEqual(['artifact', 'principal']);
  });

  it('keeps the setup artifact when the environment is misconfigured', () => {
    loadConfigMock.mockImplementation(() => {
      throw new Error('GSD_AUTH_TOKEN is required');
    });

    expect(() => prepareStartup()).toThrow('GSD_AUTH_TOKEN is required');
    // The artifact is the user's only other copy of the token.
    expect(removeSetupArtifactMock).not.toHaveBeenCalled();
  });
});

describe('startMcpServer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadConfigMock.mockReturnValue(config);
  });

  it('should_serve_through_serve_stdio_with_legacy_serve', async () => {
    const gsdServer = { name: 'gsd-task-manager' };
    const skills = { id: 'io.modelcontextprotocol/skills' };
    createGsdServerMock.mockReturnValue(gsdServer);
    loadGsdSkillsMock.mockResolvedValue(skills);

    await startMcpServer();

    expect(serveStdioMock).toHaveBeenCalledWith(expect.any(Function), { legacy: 'serve' });
    const factory = serveStdioMock.mock.calls[0]?.[0] as () => unknown;
    expect(factory()).toBe(gsdServer);
    expect(createGsdServerMock).toHaveBeenCalledWith(config, skills);
  });

  it('should_reach_no_network_before_serving', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await startMcpServer();

    expect(serveStdioMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('reportStartupFailure', () => {
  let stderrSpy: MockInstance<typeof process.stderr.write>;
  let stdoutSpy: MockInstance<typeof process.stdout.write>;

  beforeEach(() => {
    vi.resetAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  function stderrText(): string {
    return stderrSpy.mock.calls.map((call) => String(call[0])).join('');
  }

  it('explains a privileged principal with recovery steps', () => {
    reportStartupFailure(new SuperuserPrincipalError());

    expect(stderrText()).toMatch(/superuser/i);
    expect(stderrText()).toMatch(/--setup/);
    // stdout carries JSON-RPC frames; a byte here corrupts the protocol.
    expect(stdoutSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('explains any other fatal startup error instead of exiting silently', () => {
    reportStartupFailure(new Error('GSD_AUTH_TOKEN is required'));

    expect(stderrText()).toMatch(/GSD_AUTH_TOKEN is required/);
    expect(stderrText()).toMatch(/--validate/);
    expect(stdoutSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });
});
