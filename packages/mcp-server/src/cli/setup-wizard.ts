/**
 * Interactive setup wizard for MCP server configuration
 * Guides users through Supabase URL, service key, email, and encryption setup
 */

import type { GsdConfig } from '../tools.js';
import { getSyncStatus, listTasks } from '../tools.js';
import { prompt, promptPassword, getClaudeConfigPath } from './index.js';

/**
 * Test Supabase connectivity by querying sync status
 */
async function validateConnectivity(
  supabaseUrl: string,
  serviceKey: string,
  userEmail: string
): Promise<boolean> {
  process.stdout.write('Testing Supabase connectivity... ');
  try {
    const config: GsdConfig = { supabaseUrl, serviceKey, userEmail };
    const status = await getSyncStatus(config);
    console.log('✓ Success!');
    console.log(`  Devices: ${status.deviceCount}`);
    return true;
  } catch (error) {
    console.log('✗ Failed to connect');
    console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.log('Please check your Supabase URL, service key, and user email.\n');
    return false;
  }
}

/**
 * Test encryption passphrase by attempting to decrypt tasks
 */
async function testDecryption(config: GsdConfig): Promise<boolean> {
  process.stdout.write('Testing decryption... ');
  try {
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
async function configureEncryption(config: GsdConfig): Promise<string | undefined> {
  console.log('Step 4/5: Encryption (Optional)');
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

  const success = await testDecryption({ ...config, encryptionPassphrase });
  return success ? encryptionPassphrase : undefined;
}

/**
 * Display generated configuration JSON
 */
function displayConfiguration(config: GsdConfig): void {
  console.log('Step 5/5: Generated Configuration');
  console.log(`Add this to ${getClaudeConfigPath()}:\n`);

  const configJson = {
    mcpServers: {
      'gsd-tasks': {
        command: 'npx',
        args: ['-y', 'gsd-mcp-server'],
        env: {
          GSD_SUPABASE_URL: config.supabaseUrl,
          GSD_SUPABASE_SERVICE_KEY: config.serviceKey,
          GSD_USER_EMAIL: config.userEmail,
          ...(config.encryptionPassphrase
            ? { GSD_ENCRYPTION_PASSPHRASE: config.encryptionPassphrase }
            : {}),
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
  console.log('Next Steps:');
  console.log(`1. Copy the config above`);
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
    // Step 1: Supabase URL
    console.log('Step 1/5: Supabase Project URL');
    const supabaseUrl = await prompt('Enter your Supabase project URL');
    if (!supabaseUrl) {
      console.log('✗ Supabase URL is required. Exiting setup.');
      process.exit(1);
    }
    console.log();

    // Step 2: Service Key
    console.log('Step 2/5: Supabase Service Role Key');
    console.log('Find this in: Supabase Dashboard → Settings → API → service_role key');
    const serviceKey = await promptPassword('Paste service role key');
    if (!serviceKey) {
      console.log('✗ Service role key is required. Exiting setup.');
      process.exit(1);
    }
    console.log();

    // Step 3: User Email
    console.log('Step 3/5: User Email');
    const userEmail = await prompt('Enter the email you use to sign into GSD');
    if (!userEmail) {
      console.log('✗ User email is required. Exiting setup.');
      process.exit(1);
    }

    // Test connectivity
    const connected = await validateConnectivity(supabaseUrl, serviceKey, userEmail);
    if (!connected) {
      process.exit(1);
    }
    console.log();

    const config: GsdConfig = { supabaseUrl, serviceKey, userEmail };

    // Step 4: Encryption
    const encryptionPassphrase = await configureEncryption(config);
    config.encryptionPassphrase = encryptionPassphrase;
    console.log();

    // Step 5: Display Config
    displayConfiguration(config);
    displayNextSteps();
  } catch (error) {
    console.error('\n✗ Setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
