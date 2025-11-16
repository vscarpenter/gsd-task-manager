import { getCryptoManager } from '../crypto.js';
import type { GsdConfig } from '../types.js';

/**
 * Initialize encryption with user's passphrase
 * Fetches salt from server and derives encryption key
 */
export async function initializeEncryption(config: GsdConfig): Promise<void> {
  validateEncryptionConfig(config);

  const cryptoManager = getCryptoManager();
  if (cryptoManager.isInitialized()) {
    return; // Already initialized
  }

  const encryptionSalt = await fetchEncryptionSalt(config);
  await deriveEncryptionKey(config, encryptionSalt);
}

/**
 * Validate encryption configuration
 */
function validateEncryptionConfig(config: GsdConfig): void {
  if (!config.encryptionPassphrase) {
    throw new Error(
      `❌ Encryption passphrase not provided\n\n` +
        `This tool requires decrypted task access.\n\n` +
        `To enable:\n` +
        `  1. Set GSD_ENCRYPTION_PASSPHRASE in Claude Desktop config\n` +
        `  2. Use the same passphrase you set up in the GSD app\n` +
        `  3. Restart Claude Desktop\n\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }
}

/**
 * Fetch user's encryption salt from server
 */
async function fetchEncryptionSalt(config: GsdConfig): Promise<string> {
  const response = await fetchSaltEndpoint(config);
  validateSaltResponse(response, config);

  const data = (await response.json()) as { encryptionSalt: string };
  validateSaltData(data, config);

  return data.encryptionSalt;
}

/**
 * Make HTTP request to encryption salt endpoint
 */
async function fetchSaltEndpoint(config: GsdConfig): Promise<Response> {
  try {
    return await fetch(`${config.apiBaseUrl}/api/auth/encryption-salt`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `❌ Failed to fetch encryption salt\n\n` +
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }
}

/**
 * Validate salt endpoint HTTP response
 */
function validateSaltResponse(response: Response, config: GsdConfig): void {
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        `❌ Authentication failed while fetching encryption salt\n\n` +
          `Your token has expired. Run: npx gsd-mcp-server --setup`
      );
    }
    throw new Error(
      `❌ Failed to fetch encryption salt (${response.status})\n\n` +
        `The Worker API endpoint may not support encryption.\n` +
        `Ensure you're using Worker v0.2.0+\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }
}

/**
 * Validate salt data from response
 */
function validateSaltData(data: { encryptionSalt: string }, config: GsdConfig): void {
  if (!data.encryptionSalt) {
    throw new Error(
      `❌ Encryption not set up for this account\n\n` +
        `Please set up encryption in the GSD app first:\n` +
        `  1. Visit ${config.apiBaseUrl}\n` +
        `  2. Go to Settings → Sync\n` +
        `  3. Set an encryption passphrase\n` +
        `  4. Complete initial sync\n\n` +
        `Then run: npx gsd-mcp-server --setup`
    );
  }
}

/**
 * Derive encryption key from passphrase and salt
 */
async function deriveEncryptionKey(
  config: GsdConfig,
  encryptionSalt: string
): Promise<void> {
  const cryptoManager = getCryptoManager();

  try {
    await cryptoManager.deriveKey(config.encryptionPassphrase!, encryptionSalt);
  } catch (error) {
    throw new Error(
      `❌ Failed to derive encryption key\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Your passphrase or salt may be corrupted.\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }
}
