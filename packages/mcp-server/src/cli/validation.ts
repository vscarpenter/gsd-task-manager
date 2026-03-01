/**
 * Configuration validation utilities
 * Tests environment variables, PocketBase connectivity, auth, and task access
 */

import type { GsdConfig, SyncStatus } from '../tools.js';
import { getSyncStatus, listDevices, listTasks } from '../tools.js';

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
    console.log('\nRun setup wizard: npx gsd-mcp-server --setup');
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
        details: `Connected to ${pbUrl}`,
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
      details: `Failed to connect to ${pbUrl}`,
    };
  }
}

/**
 * Create sync status check result
 */
function createSyncStatusCheck(status: SyncStatus): ValidationCheck {
  return {
    name: 'Sync Status',
    status: status.healthy ? '✓' : '⚠',
    details: status.healthy
      ? `Healthy (${status.taskCount} tasks synced)`
      : 'PocketBase reports unhealthy status',
  };
}

/**
 * Validate authentication token and check sync status
 */
async function validateAuthentication(config: GsdConfig): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  try {
    const status = await getSyncStatus(config);
    checks.push({
      name: 'Authentication',
      status: '✓',
      details: `Token valid (${status.taskCount} tasks accessible)`,
    });
    checks.push(createSyncStatusCheck(status));
  } catch (error) {
    checks.push({
      name: 'Authentication',
      status: '✗',
      details: error instanceof Error ? error.message : 'Token validation failed',
    });
  }

  return checks;
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
  } catch (error) {
    return {
      name: 'Task Access',
      status: '✗',
      details: error instanceof Error ? error.message : 'Failed to read tasks',
    };
  }
}

/**
 * Test device management access
 */
async function validateDeviceAccess(config: GsdConfig): Promise<ValidationCheck> {
  try {
    const devices = await listDevices(config);
    const activeDevices = devices.filter(d => d.isActive).length;
    return {
      name: 'Device Management',
      status: '✓',
      details: `${devices.length} total devices, ${activeDevices} active`,
    };
  } catch {
    return {
      name: 'Device Management',
      status: '⚠',
      details: 'Could not fetch device list',
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

  // Step 5: Device access
  const deviceCheck = await validateDeviceAccess(config);
  checks.push(deviceCheck);

  // Print results and overall status
  printValidationResults(checks);
  displayOverallStatus(checks);
}
