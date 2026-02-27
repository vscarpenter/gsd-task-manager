/**
 * Configuration validation utilities
 * Tests environment variables, Supabase connectivity, user resolution, encryption, and device access
 */

import type { GsdConfig, SyncStatus } from '../tools.js';
import { getSyncStatus, listDevices, listTasks } from '../tools.js';
import { resolveUserId } from '../api/client.js';

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
  supabaseUrl: string;
  serviceKey: string;
  userEmail: string;
  encryptionPassphrase?: string;
} {
  const supabaseUrl = process.env.GSD_SUPABASE_URL;
  const serviceKey = process.env.GSD_SUPABASE_SERVICE_KEY;
  const userEmail = process.env.GSD_USER_EMAIL;
  const encryptionPassphrase = process.env.GSD_ENCRYPTION_PASSPHRASE;

  if (!supabaseUrl || !serviceKey || !userEmail) {
    console.log('✗ Configuration Error\n');
    console.log('Missing required environment variables:');
    if (!supabaseUrl) console.log('  - GSD_SUPABASE_URL');
    if (!serviceKey) console.log('  - GSD_SUPABASE_SERVICE_KEY');
    if (!userEmail) console.log('  - GSD_USER_EMAIL');
    console.log('\nRun setup wizard: npx gsd-mcp-server --setup');
    process.exit(1);
  }

  return { supabaseUrl, serviceKey, userEmail, encryptionPassphrase };
}

/**
 * Create sync status check result
 */
function createSyncStatusCheck(status: SyncStatus): ValidationCheck {
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
 * Validate Supabase connectivity and user resolution
 */
async function validateSupabaseConnection(config: GsdConfig): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  // Test connectivity via sync status query
  try {
    const status = await getSyncStatus(config);
    checks.push({
      name: 'Supabase Connectivity',
      status: '✓',
      details: `Connected to ${config.supabaseUrl} (${status.deviceCount} devices)`,
    });
    checks.push(createSyncStatusCheck(status));
  } catch (error) {
    checks.push({
      name: 'Supabase Connectivity',
      status: '✗',
      details: error instanceof Error ? error.message : 'Connection failed',
    });
  }

  // Test user resolution
  try {
    const userId = await resolveUserId(config);
    checks.push({
      name: 'User Resolution',
      status: '✓',
      details: `User found: ${config.userEmail} (${userId.slice(0, 8)}...)`,
    });
  } catch (error) {
    checks.push({
      name: 'User Resolution',
      status: '✗',
      details: error instanceof Error ? error.message : 'User lookup failed',
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
  const { supabaseUrl, serviceKey, userEmail, encryptionPassphrase } = validateEnvironmentVariables();

  checks.push({
    name: 'Environment Variables',
    status: '✓',
    details: `GSD_SUPABASE_URL, GSD_SUPABASE_SERVICE_KEY, and GSD_USER_EMAIL are set${encryptionPassphrase ? ' (with passphrase)' : ''}`,
  });

  const config: GsdConfig = { supabaseUrl, serviceKey, userEmail, encryptionPassphrase };

  // Step 2: Supabase connectivity & user resolution
  const connectionChecks = await validateSupabaseConnection(config);
  checks.push(...connectionChecks);

  // Step 3: Encryption
  const encryptionCheck = await validateEncryption(config, !!encryptionPassphrase);
  checks.push(encryptionCheck);

  // Step 4: Device access
  const deviceCheck = await validateDeviceAccess(config);
  checks.push(deviceCheck);

  // Print results and overall status
  printValidationResults(checks);
  displayOverallStatus(checks);
}
