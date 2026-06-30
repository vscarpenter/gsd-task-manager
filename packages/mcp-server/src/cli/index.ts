/**
 * CLI entry point for GSD MCP Server
 * Handles argument parsing, help display, and routing to setup/validation modes
 */

import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { VERSION } from '../version.js';

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
    GSD_POCKETBASE_URL  - PocketBase server URL (e.g., https://api.vinny.io)
    GSD_AUTH_TOKEN      - Auth token from PocketBase OAuth authentication

  Claude Desktop config location:
    macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
    Windows: %APPDATA%\\Claude\\claude_desktop_config.json

DOCUMENTATION:
  Full docs: https://github.com/vscarpenter/gsd-taskmanager/tree/main/packages/mcp-server
  Issues:    https://github.com/vscarpenter/gsd-taskmanager/issues

VERSION: ${VERSION}
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
function createReadline() {
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
 * Prompt for password with echo suppressed.
 *
 * Implementation note: in a TTY we put stdin into raw mode and consume bytes
 * one at a time, never writing the character back to stdout. This is the only
 * portable way to suppress echo for password input in Node — readline.question
 * always echoes, and `setRawMode(false)` is cooked mode (the default) which
 * also echoes.
 *
 * When stdin is not a TTY (CI pipeline, scripted input) we fall back to a
 * regular line read; echo behavior is whatever the caller's environment does.
 */
export async function promptPassword(question: string): Promise<string> {
  process.stdout.write(`${question}: `);

  const stdin = process.stdin as NodeJS.ReadStream;

  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    // Non-TTY fallback (CI, piped input). Read one line via readline.
    const rl = createReadline();
    return new Promise<string>((resolve) => {
      rl.question('', (answer: string) => {
        rl.close();
        process.stdout.write('\n');
        resolve(answer.trim());
      });
    });
  }

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise<string>((resolve) => {
    let buffer = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        const code = char.charCodeAt(0);
        if (char === '\n' || char === '\r' || code === 4) {
          // Enter or Ctrl-D — finalize input
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(buffer.trim());
          return;
        }
        if (code === 3) {
          // Ctrl-C — abort
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          process.exit(130);
        }
        if (code === 127 || code === 8) {
          // Backspace
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
          }
          continue;
        }
        // Append printable byte to buffer; do NOT echo to stdout.
        buffer += char;
      }
    };
    stdin.on('data', onData);
  });
}
