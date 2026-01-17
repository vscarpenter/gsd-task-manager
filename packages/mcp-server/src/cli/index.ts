/**
 * CLI entry point for GSD MCP Server
 * Handles argument parsing, help display, and routing to setup/validation modes
 */

import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export interface CLIOptions {
  mode: 'mcp' | 'setup' | 'validate' | 'help';
}

/**
 * Parse command line arguments
 */
export function parseCLIArgs(args: string[]): CLIOptions {
  const flags = args.slice(2); // Skip node and script path

  if (flags.includes('--setup')) {
    return { mode: 'setup' };
  }
  if (flags.includes('--validate')) {
    return { mode: 'validate' };
  }
  if (flags.includes('--help') || flags.includes('-h')) {
    return { mode: 'help' };
  }

  // Default: MCP server mode (stdio)
  return { mode: 'mcp' };
}

/**
 * Show help message
 */
export function showHelp(): void {
  console.log(`
🎯 GSD Task Manager MCP Server

USAGE:
  npx gsd-mcp-server [OPTIONS]

OPTIONS:
  --setup       Interactive setup wizard
  --validate    Validate existing configuration
  --help, -h    Show this help message
  (no flags)    Run MCP server (normal mode for Claude Desktop)

EXAMPLES:
  # First-time setup
  npx gsd-mcp-server --setup

  # Test your configuration
  npx gsd-mcp-server --validate

  # Run as MCP server (configured in Claude Desktop)
  npx gsd-mcp-server

CONFIGURATION:
  Environment variables (set in Claude Desktop config):
    GSD_API_URL                - Worker API URL (e.g., https://gsd.vinny.dev)
    GSD_AUTH_TOKEN             - JWT token from OAuth authentication
    GSD_ENCRYPTION_PASSPHRASE  - Optional: encryption passphrase for task decryption

  Claude Desktop config location:
    macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
    Windows: %APPDATA%\\Claude\\claude_desktop_config.json

DOCUMENTATION:
  Full docs: https://github.com/vscarpenter/gsd-taskmanager/tree/main/packages/mcp-server
  Issues:    https://github.com/vscarpenter/gsd-taskmanager/issues

VERSION: 0.6.0
`);
}

/**
 * Get Claude Desktop config file path for current platform
 */
export function getClaudeConfigPath(): string {
  const home = homedir();
  const os = platform();

  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else {
    // Linux/other
    return join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

/**
 * Create readline interface for user input
 */
export function createReadline() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createInterface } = require('node:readline');
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
export async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createReadline();

  return new Promise((resolve) => {
    const promptText = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;

    rl.question(promptText, (answer: string) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Prompt for password (hidden input)
 */
export async function promptPassword(question: string): Promise<string> {
  const rl = createReadline();

  return new Promise((resolve) => {
    // Disable echo for password input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stdin = process.stdin as any;
    const originalMode = stdin.isTTY && stdin.setRawMode ? stdin.setRawMode(false) : null;

    rl.question(`${question}: `, (answer: string) => {
      rl.close();
      if (originalMode !== null && stdin.isTTY) {
        stdin.setRawMode(originalMode);
      }
      console.log(); // New line after password input
      resolve(answer.trim());
    });
  });
}
