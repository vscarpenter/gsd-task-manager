import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadConfigMock,
  removeSetupArtifactMock,
  assertNonSuperuserPrincipalMock,
  createServerMock,
  registerHandlersMock,
  connectMock,
} = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
  removeSetupArtifactMock: vi.fn(),
  assertNonSuperuserPrincipalMock: vi.fn(),
  createServerMock: vi.fn(),
  registerHandlersMock: vi.fn(),
  connectMock: vi.fn(),
}));

vi.mock('../../server/config.js', () => ({ loadConfig: loadConfigMock }));
vi.mock('../../cli/setup-artifact.js', () => ({ removeSetupArtifact: removeSetupArtifactMock }));
vi.mock('../../pocketbase-client.js', () => ({
  assertNonSuperuserPrincipal: assertNonSuperuserPrincipalMock,
}));
vi.mock('../../server/setup.js', () => ({
  createServer: createServerMock,
  registerHandlers: registerHandlersMock,
}));
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(function StdioServerTransportMock() {
    return {};
  }),
}));

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
    createServerMock.mockReturnValue({ connect: connectMock });
  });

  it('registers handlers and connects without reaching PocketBase', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await startMcpServer();

    expect(registerHandlersMock).toHaveBeenCalledWith({ connect: connectMock }, config);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('reportStartupFailure', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

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
