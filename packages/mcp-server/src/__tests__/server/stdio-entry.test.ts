import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Spawns the real entry point over stdio, as Claude Desktop and Claude Code
 * launch it, and checks that clients on both protocol revisions get an answer
 * (tasks/spec.md, "Move the MCP server to SDK v2", AC6). The config points at an
 * unreachable PocketBase because listing tools never calls it, and HOME is a
 * throwaway folder because startup removes a setup artifact from there.
 */
const PACKAGE_DIR = fileURLToPath(new URL('../../..', import.meta.url));
const SPAWN_TIMEOUT_MS = 20_000;
const TOOL_COUNT = 20;

let client: Client | undefined;
let home: string | undefined;

afterEach(async () => {
  await client?.close();
  if (home) rmSync(home, { recursive: true, force: true });
  client = undefined;
  home = undefined;
});

async function connectOverStdio(mode: 'legacy' | 'auto'): Promise<Client> {
  home = mkdtempSync(join(tmpdir(), 'gsd-mcp-stdio-'));
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['src/index.ts'],
    cwd: PACKAGE_DIR,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: home,
      GSD_POCKETBASE_URL: 'https://pocketbase.invalid',
      GSD_AUTH_TOKEN: 'offline-test-token',
    },
    stderr: 'ignore',
  });
  client = new Client({ name: 'stdio-entry-test', version: '1.0.0' }, { versionNegotiation: { mode } });
  await client.connect(transport);
  return client;
}

describe('stdio entry point', () => {
  it('should_answer_tools_list_over_stdio_for_a_2025_11_25_client', async () => {
    const connected = await connectOverStdio('legacy');

    const { tools } = await connected.listTools();

    expect({ protocol: connected.getNegotiatedProtocolVersion(), tools: tools.length }).toEqual({
      protocol: '2025-11-25',
      tools: TOOL_COUNT,
    });
  }, SPAWN_TIMEOUT_MS);

  it('should_answer_tools_list_over_stdio_for_a_2026_07_28_client', async () => {
    const connected = await connectOverStdio('auto');

    const { tools } = await connected.listTools();

    expect({ protocol: connected.getNegotiatedProtocolVersion(), tools: tools.length }).toEqual({
      protocol: '2026-07-28',
      tools: TOOL_COUNT,
    });
  }, SPAWN_TIMEOUT_MS);
});
