/**
 * Configuration validation utilities
 * Tests environment variables, PocketBase connectivity, auth, and task access
 */

import type { GsdConfig, SyncStatus } from '../tools.js';
import { getSyncStatus, listTasks } from '../tools.js';
import { redactPocketBaseHost } from '../api/client.js';
import { isSafePocketBaseUrl, UNSAFE_POCKETBASE_URL_MESSAGE } from '../server/config.js';

/**
 * Validation check result
 */
export interface ValidationCheck {
  name: string;
  status: '✓' | '⚠' | '✗';
  details: string;
}

/**
 * Check required environment variables
 */
function validateEnvironmentVariables(): {
  pbUrl: string;
  authToken: string;
} {
  const pbUrl = process.env.GSD_POCKETBASE_URL;
  const authToken = process.env.GSD_AUTH_TOKEN;

  if (!pbUrl || !authToken) {
    console.log('✗ Configuration Error\n');
    console.log('Missing required environment variables:');
    if (!pbUrl) console.log('  - GSD_POCKETBASE_URL');
    if (!authToken) console.log('  - GSD_AUTH_TOKEN');
    console.log('\nRun setup wizard: gsd-mcp-server --setup');
    process.exit(1);
  }

  return { pbUrl, authToken };
}

/**
 * Test PocketBase connectivity via health endpoint
 */
async function validatePBConnection(pbUrl: string): Promise<ValidationCheck> {
  try {
    const response = await fetch(`${pbUrl}/api/health`);
    if (response.ok) {
      return {
        name: 'PocketBase Connectivity',
        status: '✓',
        details: `Connected to ${redactPocketBaseHost(pbUrl)}`,
      };
    } else {
      return {
        name: 'PocketBase Connectivity',
        status: '⚠',
        details: `Connected but got status ${response.status}`,
      };
    }
  } catch {
    return {
      name: 'PocketBase Connectivity',
      status: '✗',
      details: `Failed to connect to ${redactPocketBaseHost(pbUrl)}`,
    };
  }
}

/**
 * Create sync status check result
 */
/**
 * Validate authentication token and check sync status
 */
async function validateAuthentication(config: GsdConfig): Promise<ValidationCheck[]> {
  const failed: ValidationCheck = { name: 'Authentication', status: '✗', details: 'Token validation failed' };
  let status: SyncStatus;
  try {
    status = await getSyncStatus(config);
  } catch {
    return [failed];
  }
  // getSyncStatus catches its own errors and returns healthy: false, so read the
  // result rather than relying on a throw, the same rule validate_config uses.
  if (!status.healthy) return [failed];

  return [
    { name: 'Authentication', status: '✓', details: `Token valid (${status.taskCount} tasks accessible)` },
    { name: 'Sync Status', status: '✓', details: `Healthy (${status.taskCount} tasks synced)` },
  ];
}

/**
 * Test task access by listing tasks
 */
async function validateTaskAccess(config: GsdConfig): Promise<ValidationCheck> {
  try {
    const tasks = await listTasks(config);
    return {
      name: 'Task Access',
      status: '✓',
      details: `Successfully read ${tasks.length} tasks`,
    };
  } catch {
    return {
      name: 'Task Access',
      status: '✗',
      details: 'Failed to read tasks',
    };
  }
}

/**
 * Print validation results
 */
function printValidationResults(checks: ValidationCheck[]): void {
  console.log('Validation Results:\n');
  checks.forEach((check) => {
    console.log(`  ${check.status} ${check.name}`);
    console.log(`    ${check.details}`);
  });
}

/**
 * Display overall status and exit code
 */
function displayOverallStatus(checks: ValidationCheck[]): void {
  const hasErrors = checks.some(c => c.status === '✗');
  const hasWarnings = checks.some(c => c.status === '⚠');

  console.log();
  if (hasErrors) {
    console.log('❌ Configuration has errors. Please fix the issues above.');
    console.log('   Run setup wizard: gsd-mcp-server --setup');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Configuration is functional but has warnings.');
    console.log('   Everything should work, but consider addressing warnings for best experience.');
  } else {
    console.log('✅ Configuration is healthy! Your MCP server is ready to use.');
    console.log('   Restart Claude Desktop and ask: "What\'s my GSD sync status?"');
  }
}

/**
 * Validate existing configuration (main orchestrator)
 */
export async function runValidation(): Promise<void> {
  console.log(`
🔍 GSD MCP Server Configuration Validator
`);

  const checks: ValidationCheck[] = [];

  // Step 1: Environment variables
  const { pbUrl, authToken } = validateEnvironmentVariables();

  // Gate the destination through the shared policy before any request so a
  // misconfigured GSD_POCKETBASE_URL can never receive the auth token.
  if (!isSafePocketBaseUrl(pbUrl)) {
    console.log('✗ Configuration Error\n');
    console.log(UNSAFE_POCKETBASE_URL_MESSAGE);
    console.log(`\nGSD_POCKETBASE_URL is currently: ${redactPocketBaseHost(pbUrl)}`);
    process.exit(1);
  }

  checks.push({
    name: 'Environment Variables',
    status: '✓',
    details: 'GSD_POCKETBASE_URL and GSD_AUTH_TOKEN are set',
  });

  const config: GsdConfig = { pocketBaseUrl: pbUrl, authToken };

  // Step 2: PocketBase connectivity
  const connectivityCheck = await validatePBConnection(pbUrl);
  checks.push(connectivityCheck);

  // Step 3: Authentication & sync status
  const authChecks = await validateAuthentication(config);
  checks.push(...authChecks);

  // Step 4: Task access
  const taskCheck = await validateTaskAccess(config);
  checks.push(taskCheck);

  // Print results and overall status
  printValidationResults(checks);
  displayOverallStatus(checks);
}
