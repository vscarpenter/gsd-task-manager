#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseCLIArgs, showHelp, runSetupWizard, runValidation } from './cli.js';
import { loadConfig } from './server/config.js';
import { createServer, registerHandlers } from './server/setup.js';
import { createMcpLogger } from './utils/logger.js';
import { initSentry, captureException, flush } from './utils/sentry.js';

const logger = createMcpLogger('SERVER');

/**
 * GSD Task Manager MCP Server
 *
 * Main entry point for the Model Context Protocol server.
 * Handles CLI argument parsing and server initialization.
 */
async function main() {
  // Opt-in error reporting — no-op unless the user sets GSD_SENTRY_DSN.
  initSentry();

  // Parse CLI arguments
  const options = parseCLIArgs(process.argv);

  // Handle CLI modes
  if (options.mode === 'help') {
    showHelp();
    process.exit(0);
  }

  if (options.mode === 'setup') {
    await runSetupWizard();
    process.exit(0);
  }

  if (options.mode === 'validate') {
    await runValidation();
    process.exit(0);
  }

  // MCP mode: Load configuration from environment
  let config;
  try {
    config = loadConfig();
  } catch {
    process.exit(1);
  }

  // Create MCP server
  const server = createServer();

  // Register all request handlers
  registerHandlers(server, config);

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('GSD MCP Server running on stdio');
}

main().catch(async (error) => {
  captureException(error, { module: 'SERVER', phase: 'fatal' });
  console.error('Fatal error:', error);
  // Flush queued events before exit (no-op unless Sentry is initialized).
  await flush();
  process.exit(1);
});
