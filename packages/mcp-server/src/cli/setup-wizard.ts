/**
 * Interactive setup wizard for MCP server configuration
 * Guides users through PocketBase URL and auth token setup
 */

import type { GsdConfig } from '../tools.js';
import { getSyncStatus, listTasks } from '../tools.js';
import { prompt, promptPassword, getClaudeConfigPath } from './index.js';

/** Default production PocketBase URL used as prompt default value */
const DEFAULT_POCKETBASE_URL = 'https://api.vinny.io';

/**
 * Test PocketBase connectivity via health endpoint
 */
async function validateConnectivity(pbUrl: string): Promise<boolean> {
  process.stdout.write('Testing connectivity... ');
  try {
    const response = await fetch(`${pbUrl}/api/health`);
    if (response.ok) {
      console.log('✓ Success!');
      return true;
    } else {
      console.log(`⚠ Warning: Got status ${response.status}`);
      return false;
    }
  } catch {
    console.log('✗ Failed to connect');
    console.log('Continuing anyway - you may need to check your URL later.\n');
    return false;
  }
}

/**
 * Configure and validate authentication token
 */
async function configureAuthentication(pbUrl: string): Promise<string> {
  console.log('Step 2/4: Authentication Token');
  console.log('Visit the GSD app and log in with Google or GitHub OAuth');
  console.log('Copy the PocketBase auth token from: DevTools → Application → Local Storage → pocketbase_auth');
  const authToken = await promptPassword('Paste token');

  if (!authToken) {
    console.log('✗ Token is required. Exiting setup.');
    process.exit(1);
  }

  // Validate token by checking sync status
  process.stdout.write('Validating token... ');
  try {
    const config: GsdConfig = { pocketBaseUrl: pbUrl, authToken };
    const status = await getSyncStatus(config);
    console.log('✓ Success!');
    console.log(`  Tasks in PocketBase: ${status.taskCount}`);
    console.log();
    return authToken;
  } catch (error) {
    console.log('✗ Token validation failed');
    console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.log('\nPlease check your token and try again.');
    process.exit(1);
  }
}

/**
 * Test task access by listing tasks
 */
async function testTaskAccess(pbUrl: string, authToken: string): Promise<void> {
  process.stdout.write('Testing task access... ');
  try {
    const config: GsdConfig = { pocketBaseUrl: pbUrl, authToken };
    const tasks = await listTasks(config);
    console.log(`✓ Success! (Found ${tasks.length} tasks)`);
  } catch (error) {
    console.log('⚠ Could not list tasks');
    console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.log('This may resolve after tasks are synced.\n');
  }
}

/**
 * Display generated configuration JSON
 */
function displayConfiguration(pbUrl: string, authToken: string): void {
  console.log('Step 3/4: Generated Configuration');
  console.log(`Add this to ${getClaudeConfigPath()}:\n`);

  const configJson = {
    mcpServers: {
      'gsd-tasks': {
        command: 'npx',
        args: ['-y', 'gsd-mcp-server'],
        env: {
          GSD_POCKETBASE_URL: pbUrl,
          GSD_AUTH_TOKEN: authToken,
        },
      },
    },
  };

  console.log(JSON.stringify(configJson, null, 2));
  console.log();
}

/**
 * Display next steps for user
 */
function displayNextSteps(): void {
  console.log('Step 4/4: Next Steps');
  console.log('1. Copy the config above');
  console.log(`2. Open ${getClaudeConfigPath()}`);
  console.log('3. Add the configuration to the "mcpServers" section');
  console.log('4. Restart Claude Desktop');
  console.log("5. Ask Claude: \"What's my GSD sync status?\"");
  console.log();
  console.log('✓ Setup complete! Need help? Run: npx gsd-mcp-server --help');
}

/**
 * Interactive setup wizard main orchestrator
 */
export async function runSetupWizard(): Promise<void> {
  console.log(`
🎯 GSD MCP Server Setup Wizard

Welcome! This wizard will help you configure the MCP server for Claude Desktop.
`);

  try {
    // Step 1: PocketBase URL
    console.log('Step 1/4: PocketBase URL');
    const pbUrl = await prompt('Enter your PocketBase URL', DEFAULT_POCKETBASE_URL);
    await validateConnectivity(pbUrl);
    console.log();

    // Step 2: Auth Token
    const authToken = await configureAuthentication(pbUrl);

    // Verify task access
    await testTaskAccess(pbUrl, authToken);
    console.log();

    // Step 3: Display Config
    displayConfiguration(pbUrl, authToken);

    // Step 4: Next Steps
    displayNextSteps();
  } catch (error) {
    console.error('\n✗ Setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
