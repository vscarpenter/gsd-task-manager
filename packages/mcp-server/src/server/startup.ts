/**
 * MCP-mode startup sequence.
 *
 * Split out of index.ts so the ORDER of operations is unit-testable without
 * spawning a process. A test that drives index.ts with a stubbed `process.exit`
 * is a false green: the stub does not terminate, so execution falls through the
 * catch and the assertions pass against broken code.
 *
 * This module owns no process lifecycle — it throws, and index.ts decides how to
 * exit. It writes only to stderr: stdout carries JSON-RPC frames, and a single
 * stray byte there corrupts the transport.
 *
 * Startup depends only on local state (an env parse plus offline JWT claims), so
 * no PocketBase outage can stop the server from registering its tools. The
 * server-authoritative principal check stays where it already was, on the first
 * account-scoped call.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { removeSetupArtifact } from '../cli/setup-artifact.js';
import { SuperuserPrincipalError } from '../errors.js';
import { assertNonSuperuserPrincipal } from '../pocketbase-client.js';
import { loadConfig } from './config.js';
import { createServer, registerHandlers } from './setup.js';
import type { GsdConfig } from '../types.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('SERVER');

/** Plain-text recovery steps; JSON log lines escape newlines and read badly. */
const PRIVILEGED_PRINCIPAL_HELP = [
  'GSD MCP server refused to start: GSD_AUTH_TOKEN is a PocketBase superuser token.',
  'This server is account-scoped and never runs as an administrator.',
  'Recover:',
  '  1. Sign in at https://gsd.vinny.dev with your normal account',
  '  2. Run: gsd-mcp-server --setup',
  '  3. Restart Claude Desktop',
].join('\n');

const STARTUP_FAILED_FOOTER =
  'GSD MCP server did not start. Run "gsd-mcp-server --validate" for a full diagnostic.';

export function prepareStartup(): GsdConfig {
  // A throw here is an invalid environment; loadConfig has already written its
  // own actionable lines to stderr.
  const config = loadConfig();

  // The artifact holds the same token the environment just proved it carries, so
  // it is redundant from here on. Removed BEFORE the principal gate so a refusal
  // can never leave the plaintext token behind.
  removeSetupArtifact();

  assertNonSuperuserPrincipal(config);
  return config;
}

export async function startMcpServer(): Promise<void> {
  const config = prepareStartup();

  const server = createServer();
  registerHandlers(server, config);

  await server.connect(new StdioServerTransport());
  logger.info('GSD MCP Server running on stdio');
}

/**
 * Report a fatal startup failure. Every path writes a structured line and a
 * plain-text next step to stderr, so the launcher never shows a bare
 * "server disconnected" with nothing to act on.
 */
export function reportStartupFailure(error: unknown): void {
  const failure = error instanceof Error ? error : new Error(String(error));

  if (error instanceof SuperuserPrincipalError) {
    logger.error('Refusing to start with a privileged PocketBase principal', failure);
    process.stderr.write(`${PRIVILEGED_PRINCIPAL_HELP}\n`);
    return;
  }

  logger.error('MCP server failed to start', failure);
  process.stderr.write(`${STARTUP_FAILED_FOOTER}\n`);
}
