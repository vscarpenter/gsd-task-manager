import { z } from 'zod';
import type { GsdConfig } from '../tools.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('CONFIG');

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
    logger.error('Configuration error', error instanceof Error ? error : new Error(String(error)));
    logger.info('Required environment variables: GSD_API_URL, GSD_AUTH_TOKEN | Optional: GSD_ENCRYPTION_PASSPHRASE');
    logger.info('Run setup wizard with: npx gsd-mcp-server --setup');
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
    // loadConfig throws on invalid config - return false without propagating
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
