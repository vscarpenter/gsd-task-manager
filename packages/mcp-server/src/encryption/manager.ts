import { getCryptoManager } from '../crypto.js';
import { getSupabaseClient, resolveUserId } from '../api/client.js';
import type { GsdConfig } from '../types.js';

/**
 * Initialize encryption with user's passphrase
 * Fetches salt from Supabase profiles table and derives encryption key
 */
export async function initializeEncryption(config: GsdConfig): Promise<void> {
  validateEncryptionConfig(config);

  const cryptoManager = getCryptoManager();
  if (cryptoManager.isInitialized()) {
    return;
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
 * Fetch user's encryption salt from Supabase profiles table
 */
async function fetchEncryptionSalt(config: GsdConfig): Promise<string> {
  const userId = await resolveUserId(config);
  const supabase = getSupabaseClient(config);

  const { data, error } = await supabase
    .from('profiles')
    .select('encryption_salt')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(
      `❌ Failed to fetch encryption salt\n\n` +
        `Database error: ${error.message}\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  if (!data?.encryption_salt) {
    throw new Error(
      `❌ Encryption not set up for this account\n\n` +
        `Please set up encryption in the GSD app first:\n` +
        `  1. Open the GSD app\n` +
        `  2. Go to Settings → Sync\n` +
        `  3. Set an encryption passphrase\n` +
        `  4. Complete initial sync\n\n` +
        `Then run: npx gsd-mcp-server --setup`
    );
  }

  return data.encryption_salt;
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
