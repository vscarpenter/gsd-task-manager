import { z } from 'zod';
import type { GsdConfig } from '../tools.js';

/**
 * Configuration schema for GSD MCP Server
 * Validates environment variables and ensures required fields are present
 */
export const configSchema = z.object({
  apiBaseUrl: z.string().url(),
  authToken: z.string().min(1),
  encryptionPassphrase: z.string().optional(), // Optional: for decrypting tasks
});

export type ConfigSchema = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 * @throws {Error} If configuration is invalid or missing required fields
 */
export function loadConfig(): GsdConfig {
  try {
    return configSchema.parse({
      apiBaseUrl: process.env.GSD_API_URL,
      authToken: process.env.GSD_AUTH_TOKEN,
      encryptionPassphrase: process.env.GSD_ENCRYPTION_PASSPHRASE,
    });
  } catch (error) {
    console.error('❌ Configuration error:', error);
    console.error('\nRequired environment variables:');
    console.error('  GSD_API_URL - Base URL of your GSD Worker API (e.g., https://gsd.vinny.dev)');
    console.error('  GSD_AUTH_TOKEN - JWT token from OAuth authentication');
    console.error('\nOptional environment variables:');
    console.error('  GSD_ENCRYPTION_PASSPHRASE - Your encryption passphrase (enables decrypted task access)');
    console.error('\n💡 Tip: Run setup wizard with: npx gsd-mcp-server --setup');
    throw error;
  }
}

/**
 * Check if configuration is valid without throwing
 * @returns {boolean} True if config is valid, false otherwise
 */
export function isConfigValid(): boolean {
  try {
    loadConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get configuration status for diagnostics
 */
export function getConfigStatus(): {
  hasApiUrl: boolean;
  hasAuthToken: boolean;
  hasEncryptionPassphrase: boolean;
  isValid: boolean;
} {
  return {
    hasApiUrl: !!process.env.GSD_API_URL,
    hasAuthToken: !!process.env.GSD_AUTH_TOKEN,
    hasEncryptionPassphrase: !!process.env.GSD_ENCRYPTION_PASSPHRASE,
    isValid: isConfigValid(),
  };
}
