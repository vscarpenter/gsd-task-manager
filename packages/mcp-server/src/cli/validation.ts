/**
 * Configuration validation utilities
 * Tests environment variables, API connectivity, auth, encryption, and device access
 */

import type { GsdConfig } from '../tools.js';
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
  apiUrl: string;
  authToken: string;
  encryptionPassphrase?: string;
} {
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

  return { apiUrl, authToken, encryptionPassphrase };
}

/**
 * Test API connectivity
 */
async function validateApiConnection(apiUrl: string): Promise<ValidationCheck> {
  try {
    const response = await fetch(`${apiUrl}/health`);
    if (response.ok) {
      return {
        name: 'API Connectivity',
        status: '✓',
        details: `Connected to ${apiUrl}`,
      };
    } else {
      return {
        name: 'API Connectivity',
        status: '⚠',
        details: `Connected but got status ${response.status}`,
      };
    }
  } catch {
    return {
      name: 'API Connectivity',
      status: '✗',
      details: `Failed to connect to ${apiUrl}`,
    };
  }
}

/**
 * Create sync status check result
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSyncStatusCheck(status: any): ValidationCheck {
  const hasConflicts = status.conflictCount > 0;
  return {
    name: 'Sync Status',
    status: hasConflicts ? '⚠' : '✓',
    details: hasConflicts
      ? `${status.conflictCount} conflicts detected`
      : `Healthy (last sync: ${status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'never'})`,
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
      details: `Token valid (${status.deviceCount} devices registered)`,
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
 * Test encryption passphrase
 */
async function validateEncryption(
  config: GsdConfig,
  hasPassphrase: boolean
): Promise<ValidationCheck> {
  if (!hasPassphrase) {
    return {
      name: 'Encryption',
      status: '⚠',
      details: 'Passphrase not provided (task content not accessible)',
    };
  }

  try {
    const tasks = await listTasks(config);
    return {
      name: 'Encryption',
      status: '✓',
      details: `Successfully decrypted ${tasks.length} tasks`,
    };
  } catch (error) {
    return {
      name: 'Encryption',
      status: '✗',
      details: error instanceof Error ? error.message : 'Decryption failed',
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
  const { apiUrl, authToken, encryptionPassphrase } = validateEnvironmentVariables();

  checks.push({
    name: 'Environment Variables',
    status: '✓',
    details: `GSD_API_URL and GSD_AUTH_TOKEN are set${encryptionPassphrase ? ' (with passphrase)' : ''}`,
  });

  const config: GsdConfig = { apiBaseUrl: apiUrl, authToken, encryptionPassphrase };

  // Step 2: API connectivity
  const connectivityCheck = await validateApiConnection(apiUrl);
  checks.push(connectivityCheck);

  // Step 3: Authentication & sync status
  const authChecks = await validateAuthentication(config);
  checks.push(...authChecks);

  // Step 4: Encryption
  const encryptionCheck = await validateEncryption(config, !!encryptionPassphrase);
  checks.push(encryptionCheck);

  // Step 5: Device access
  const deviceCheck = await validateDeviceAccess(config);
  checks.push(deviceCheck);

  // Print results and overall status
  printValidationResults(checks);
  displayOverallStatus(checks);
}
