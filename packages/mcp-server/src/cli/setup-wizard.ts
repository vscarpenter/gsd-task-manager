/**
 * Interactive setup wizard for MCP server configuration
 * Guides users through API URL, auth token, and encryption setup
 */

import type { GsdConfig } from '../tools.js';
import { getSyncStatus, listTasks } from '../tools.js';
import { prompt, promptPassword, getClaudeConfigPath } from './index.js';

/**
 * Test API connectivity
 */
async function validateConnectivity(apiUrl: string): Promise<boolean> {
  process.stdout.write('Testing connectivity... ');
  try {
    const response = await fetch(`${apiUrl}/health`);
    if (response.ok) {
      console.log('✓ Success!');
      return true;
    } else {
      console.log(`⚠ Warning: Got status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('✗ Failed to connect');
    console.log('Continuing anyway - you may need to check your URL later.\n');
    return false;
  }
}

/**
 * Configure and validate authentication token
 */
async function configureAuthentication(apiUrl: string): Promise<string> {
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
    console.log(`  Device count: ${status.deviceCount}`);
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
 * Test encryption passphrase by attempting to decrypt tasks
 */
async function testDecryption(
  apiUrl: string,
  authToken: string,
  passphrase: string
): Promise<boolean> {
  process.stdout.write('Testing decryption... ');
  try {
    const config: GsdConfig = { apiBaseUrl: apiUrl, authToken, encryptionPassphrase: passphrase };
    const tasks = await listTasks(config);
    console.log(`✓ Success! (Found ${tasks.length} tasks)`);
    return true;
  } catch (error) {
    console.log('✗ Decryption failed');
    console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.log('\nContinuing without encryption...');
    return false;
  }
}

/**
 * Configure and test encryption passphrase
 */
async function configureEncryption(
  apiUrl: string,
  authToken: string
): Promise<string | undefined> {
  console.log('Step 3/5: Encryption (Optional)');
  const enableEncryption = await prompt(
    'Enable task decryption? This allows Claude to read task content. [y/N]',
    'N'
  );

  if (enableEncryption.toLowerCase() !== 'y') {
    return undefined;
  }

  const encryptionPassphrase = await promptPassword('Enter your encryption passphrase');
  if (!encryptionPassphrase) {
    return undefined;
  }

  const success = await testDecryption(apiUrl, authToken, encryptionPassphrase);
  return success ? encryptionPassphrase : undefined;
}

/**
 * Display generated configuration JSON
 */
function displayConfiguration(
  apiUrl: string,
  authToken: string,
  encryptionPassphrase?: string
): void {
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
}

/**
 * Display next steps for user
 */
function displayNextSteps(): void {
  console.log('Step 5/5: Next Steps');
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
    // Step 1: API URL
    console.log('Step 1/5: API URL');
    const apiUrl = await prompt('Enter your GSD Worker URL', 'https://gsd.vinny.dev');
    await validateConnectivity(apiUrl);
    console.log();

    // Step 2: Auth Token
    const authToken = await configureAuthentication(apiUrl);

    // Step 3: Encryption
    const encryptionPassphrase = await configureEncryption(apiUrl, authToken);
    console.log();

    // Step 4: Display Config
    displayConfiguration(apiUrl, authToken, encryptionPassphrase);

    // Step 5: Next Steps
    displayNextSteps();
  } catch (error) {
    console.error('\n✗ Setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
