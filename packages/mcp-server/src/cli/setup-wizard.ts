/**
 * Interactive setup wizard for MCP server configuration
 * Guides users through PocketBase URL and auth token setup
 */

import { writeFileSync, chmodSync } from 'node:fs';
import type { GsdConfig } from '../tools.js';
import { getSyncStatus, listTasks } from '../tools.js';
import { isSafePocketBaseUrl, UNSAFE_POCKETBASE_URL_MESSAGE } from '../server/config.js';
import { prompt, promptPassword, getClaudeConfigPath } from './index.js';
import { getSetupArtifactPath, removeSetupArtifact } from './setup-artifact.js';

/** Default production PocketBase URL used as prompt default value */
const DEFAULT_POCKETBASE_URL = process.env.GSD_POCKETBASE_URL || 'https://api.vinny.io';

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
 * Write the generated config snippet to a chmod-600 file. The token is never
 * printed to stdout (no terminal scrollback, no screenshot leak, no shell
 * history if the output is piped). The user reads the file to copy the
 * config into Claude Desktop; the file is removed automatically the first
 * time the MCP server starts with valid env config.
 */
function writeConfigurationFile(pbUrl: string, authToken: string): string {
  const artifactPath = getSetupArtifactPath();
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

  // Write first, then chmod — avoids a brief window where the file is
  // world-readable on POSIX. Use writeFileSync with mode option for the
  // initial write, and chmodSync as belt-and-braces (mode is honored on
  // Linux/macOS; on Windows the chmod is a no-op but the file lives in
  // the user's home directory under the user's ACLs).
  writeFileSync(artifactPath, JSON.stringify(configJson, null, 2), {
    mode: 0o600,
  });
  chmodSync(artifactPath, 0o600);
  return artifactPath;
}

/**
 * Display configuration step. Writes the JSON to a chmod-600 file and prints
 * only a redacted preview to the terminal so the token never lives in
 * scrollback, screenshots, or shell history.
 */
function displayConfiguration(pbUrl: string, authToken: string): void {
  const configPath = writeConfigurationFile(pbUrl, authToken);
  const tokenPreview =
    authToken.length > 6
      ? `${authToken.slice(0, 3)}…${authToken.slice(-3)} (${authToken.length} chars)`
      : `(${authToken.length} chars)`;

  console.log('Step 3/4: Generated Configuration');
  console.log(`Written to: ${configPath}  (mode 0600, owner-only)`);
  console.log();
  console.log('Preview (token redacted — full token is in the file above):\n');
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          'gsd-tasks': {
            command: 'npx',
            args: ['-y', 'gsd-mcp-server'],
            env: {
              GSD_POCKETBASE_URL: pbUrl,
              GSD_AUTH_TOKEN: `<see ${configPath}>  // ${tokenPreview}`,
            },
          },
        },
      },
      null,
      2
    )
  );
  console.log();
}

/**
 * Display next steps for user
 */
function displayNextSteps(): void {
  const artifactPath = getSetupArtifactPath();
  console.log('Step 4/4: Next Steps');
  console.log(`1. Open the generated file:  cat ${artifactPath}`);
  console.log(`2. Open Claude Desktop config: ${getClaudeConfigPath()}`);
  console.log('3. Merge the "mcpServers" section into the Claude config');
  console.log('4. Restart Claude Desktop');
  console.log("5. Ask Claude: \"What's my GSD sync status?\"");
  console.log();
  console.log(
    'The generated file is deleted automatically the first time the MCP server starts.'
  );
  console.log(`To remove it sooner:  rm ${artifactPath}`);
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

  // A previous run (including one aborted mid-wizard via process.exit) may
  // have left a token-bearing artifact behind — clear it before prompting.
  removeSetupArtifact();

  try {
    // Step 1: PocketBase URL
    console.log('Step 1/4: PocketBase URL');
    const pbUrl = await prompt('Enter your PocketBase URL', DEFAULT_POCKETBASE_URL);
    // Gate the destination through the shared policy BEFORE any request — the
    // connectivity probe and (later) the token-bearing sync check must never
    // reach an unvalidated host.
    if (!isSafePocketBaseUrl(pbUrl)) {
      console.log(`✗ ${UNSAFE_POCKETBASE_URL_MESSAGE}`);
      process.exit(1);
    }
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
    // Best-effort cleanup so a partial setup does not leave a token at rest.
    removeSetupArtifact();
    console.error('\n✗ Setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
