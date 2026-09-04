#!/usr/bin/env node

import { parseCLIArgs, showHelp, runSetupWizard, runValidation } from './cli.js';
import { reportStartupFailure, startMcpServer } from './server/startup.js';
import { flush, initSentry, reportFatal } from './utils/sentry.js';

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

  // MCP mode. Startup touches only local state, so a PocketBase outage cannot
  // stop the server from coming up; see ./server/startup.ts.
  try {
    await startMcpServer();
  } catch (error) {
    // reportStartupFailure already captured this via logger.error — flush
    // rather than re-capture, then exit. No-op without GSD_SENTRY_DSN.
    reportStartupFailure(error);
    await flush().catch(() => false);
    process.exit(1);
  }
}

main().catch(async (error) => {
  // Diagnostic first so it is never lost to a telemetry failure.
  console.error('Fatal error:', error);
  // Best-effort capture + flush; reportFatal is guaranteed not to throw.
  await reportFatal(error);
  process.exit(1);
});
