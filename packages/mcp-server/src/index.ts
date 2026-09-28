#!/usr/bin/env node

import { parseCLIArgs, showHelp, runSetupWizard, runValidation } from './cli.js';
import { reportStartupFailure, startMcpServer } from './server/startup.js';

/**
 * GSD Task Manager MCP Server
 *
 * Main entry point for the Model Context Protocol server.
 * Handles CLI argument parsing and server initialization.
 */
async function main() {
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

  // MCP mode. Startup touches only local state, so a PocketBase outage cannot
  // stop the server from coming up; see ./server/startup.ts.
  try {
    await startMcpServer();
  } catch (error) {
    reportStartupFailure(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
