/**
 * CLI utilities for interactive setup and validation
 */

import { createInterface } from 'node:readline';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import type { GsdConfig } from './tools.js';
import { getSyncStatus, listDevices, listTasks } from './tools.js';
import { getCryptoManager } from './crypto.js';

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

VERSION: 0.3.0
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
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createReadline();

  return new Promise((resolve) => {
    const promptText = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Prompt for password (hidden input)
 */
async function promptPassword(question: string): Promise<string> {
  const rl = createReadline();

  return new Promise((resolve) => {
    // Disable echo for password input
    const stdin = process.stdin as any;
    const originalMode = stdin.isTTY && stdin.setRawMode ? stdin.setRawMode(false) : null;

    rl.question(`${question}: `, (answer) => {
      rl.close();
      if (originalMode !== null && stdin.isTTY) {
        stdin.setRawMode(originalMode);
      }
      console.log(); // New line after password input
      resolve(answer.trim());
    });
  });
}

/**
 * Interactive setup wizard
 */
export async function runSetupWizard(): Promise<void> {
  console.log(`
🎯 GSD MCP Server Setup Wizard

Welcome! This wizard will help you configure the MCP server for Claude Desktop.
`);

  try {
    // Step 1: API URL
    console.log('Step 1/5: API URL');
    const apiUrl = await prompt('Enter your GSD Worker URL', 'https://gsd.vinny.dev');

    // Test connectivity
    process.stdout.write('Testing connectivity... ');
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) {
        console.log('✓ Success!');
      } else {
        console.log(`⚠ Warning: Got status ${response.status}`);
      }
    } catch (error) {
      console.log('✗ Failed to connect');
      console.log('Continuing anyway - you may need to check your URL later.\n');
    }
    console.log();

    // Step 2: Auth Token
    console.log('Step 2/5: Authentication Token');
    console.log('Visit', apiUrl, 'and complete OAuth login');
    console.log('Copy the token from: DevTools → Application → Local Storage → gsd_auth_token');
    const authToken = await promptPassword('Paste token');

    if (!authToken) {
      console.log('✗ Token is required. Exiting setup.');
      process.exit(1);
    }

    // Validate token
    process.stdout.write('Validating token... ');
    try {
      const config: GsdConfig = { apiBaseUrl: apiUrl, authToken };
      const status = await getSyncStatus(config);
      console.log('✓ Success!');

      // Calculate token expiration (JWT tokens expire in 7 days)
      console.log(`  Device count: ${status.deviceCount}`);
      console.log();
    } catch (error) {
      console.log('✗ Token validation failed');
      console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log('\nPlease check your token and try again.');
      process.exit(1);
    }

    // Step 3: Encryption (optional)
    console.log('Step 3/5: Encryption (Optional)');
    const enableEncryption = await prompt('Enable task decryption? This allows Claude to read task content. [y/N]', 'N');

    let encryptionPassphrase: string | undefined;

    if (enableEncryption.toLowerCase() === 'y') {
      encryptionPassphrase = await promptPassword('Enter your encryption passphrase');

      if (encryptionPassphrase) {
        // Test decryption
        process.stdout.write('Testing decryption... ');
        try {
          const config: GsdConfig = { apiBaseUrl: apiUrl, authToken, encryptionPassphrase };
          const tasks = await listTasks(config);
          console.log(`✓ Success! (Found ${tasks.length} tasks)`);
        } catch (error) {
          console.log('✗ Decryption failed');
          console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
          console.log('\nContinuing without encryption...');
          encryptionPassphrase = undefined;
        }
      }
    }
    console.log();

    // Step 4: Generated Configuration
    console.log('Step 4/5: Generated Configuration');
    console.log(`Add this to ${getClaudeConfigPath()}:\n`);

    const configJson = {
      mcpServers: {
        'gsd-tasks': {
          command: 'npx',
          args: ['-y', 'gsd-mcp-server'],
          env: {
            GSD_API_URL: apiUrl,
            GSD_AUTH_TOKEN: authToken,
            ...(encryptionPassphrase ? { GSD_ENCRYPTION_PASSPHRASE: encryptionPassphrase } : {}),
          },
        },
      },
    };

    console.log(JSON.stringify(configJson, null, 2));
    console.log();

    // Step 5: Next Steps
    console.log('Step 5/5: Next Steps');
    console.log('1. Copy the config above');
    console.log(`2. Open ${getClaudeConfigPath()}`);
    console.log('3. Add the configuration to the "mcpServers" section');
    console.log('4. Restart Claude Desktop');
    console.log('5. Ask Claude: "What\'s my GSD sync status?"');
    console.log();
    console.log('✓ Setup complete! Need help? Run: npx gsd-mcp-server --help');
  } catch (error) {
    console.error('\n✗ Setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Validation check result
 */
interface ValidationCheck {
  name: string;
  status: '✓' | '⚠' | '✗';
  details: string;
}

/**
 * Validate existing configuration
 */
export async function runValidation(): Promise<void> {
  console.log(`
🔍 GSD MCP Server Configuration Validator
`);

  const checks: ValidationCheck[] = [];

  // Check 1: Environment variables
  const apiUrl = process.env.GSD_API_URL;
  const authToken = process.env.GSD_AUTH_TOKEN;
  const encryptionPassphrase = process.env.GSD_ENCRYPTION_PASSPHRASE;

  if (!apiUrl || !authToken) {
    console.log('✗ Configuration Error\n');
    console.log('Missing required environment variables:');
    if (!apiUrl) console.log('  - GSD_API_URL');
    if (!authToken) console.log('  - GSD_AUTH_TOKEN');
    console.log('\nRun setup wizard: npx gsd-mcp-server --setup');
    process.exit(1);
  }

  checks.push({
    name: 'Environment Variables',
    status: '✓',
    details: `GSD_API_URL and GSD_AUTH_TOKEN are set${encryptionPassphrase ? ' (with passphrase)' : ''}`,
  });

  const config: GsdConfig = { apiBaseUrl: apiUrl, authToken, encryptionPassphrase };

  // Check 2: API Connectivity
  try {
    const response = await fetch(`${apiUrl}/health`);
    if (response.ok) {
      checks.push({
        name: 'API Connectivity',
        status: '✓',
        details: `Connected to ${apiUrl}`,
      });
    } else {
      checks.push({
        name: 'API Connectivity',
        status: '⚠',
        details: `Connected but got status ${response.status}`,
      });
    }
  } catch (error) {
    checks.push({
      name: 'API Connectivity',
      status: '✗',
      details: `Failed to connect to ${apiUrl}`,
    });
  }

  // Check 3: Authentication
  try {
    const status = await getSyncStatus(config);
    checks.push({
      name: 'Authentication',
      status: '✓',
      details: `Token valid (${status.deviceCount} devices registered)`,
    });

    // Check 4: Sync Status
    const hasConflicts = status.conflictCount > 0;
    checks.push({
      name: 'Sync Status',
      status: hasConflicts ? '⚠' : '✓',
      details: hasConflicts
        ? `${status.conflictCount} conflicts detected`
        : `Healthy (last sync: ${status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'never'})`,
    });
  } catch (error) {
    checks.push({
      name: 'Authentication',
      status: '✗',
      details: error instanceof Error ? error.message : 'Token validation failed',
    });
  }

  // Check 5: Encryption (if passphrase provided)
  if (encryptionPassphrase) {
    try {
      const tasks = await listTasks(config);
      checks.push({
        name: 'Encryption',
        status: '✓',
        details: `Successfully decrypted ${tasks.length} tasks`,
      });
    } catch (error) {
      checks.push({
        name: 'Encryption',
        status: '✗',
        details: error instanceof Error ? error.message : 'Decryption failed',
      });
    }
  } else {
    checks.push({
      name: 'Encryption',
      status: '⚠',
      details: 'Passphrase not provided (task content not accessible)',
    });
  }

  // Check 6: Device Management
  try {
    const devices = await listDevices(config);
    const activeDevices = devices.filter(d => d.isActive).length;
    checks.push({
      name: 'Device Management',
      status: '✓',
      details: `${devices.length} total devices, ${activeDevices} active`,
    });
  } catch (error) {
    checks.push({
      name: 'Device Management',
      status: '⚠',
      details: 'Could not fetch device list',
    });
  }

  // Print results
  console.log('Validation Results:\n');
  checks.forEach((check) => {
    console.log(`  ${check.status} ${check.name}`);
    console.log(`    ${check.details}`);
  });

  // Overall status
  const hasErrors = checks.some(c => c.status === '✗');
  const hasWarnings = checks.some(c => c.status === '⚠');

  console.log();
  if (hasErrors) {
    console.log('❌ Configuration has errors. Please fix the issues above.');
    console.log('   Run setup wizard: npx gsd-mcp-server --setup');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Configuration is functional but has warnings.');
    console.log('   Everything should work, but consider addressing warnings for best experience.');
  } else {
    console.log('✅ Configuration is healthy! Your MCP server is ready to use.');
    console.log('   Restart Claude Desktop and ask: "What\'s my GSD sync status?"');
  }
}
