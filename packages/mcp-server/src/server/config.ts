import { z } from 'zod';
import type { GsdConfig } from '../types.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('CONFIG');

/**
 * Configuration schema for GSD MCP Server (Supabase backend)
 * Validates environment variables and ensures required fields are present
 */
export const configSchema = z.object({
  supabaseUrl: z.string().url(),
  serviceKey: z.string().min(1),
  userEmail: z.string().email(),
  encryptionPassphrase: z.string().optional(),
});

export type ConfigSchema = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 * @throws {Error} If configuration is invalid or missing required fields
 */
export function loadConfig(): GsdConfig {
  try {
    return configSchema.parse({
      supabaseUrl: process.env.GSD_SUPABASE_URL,
      serviceKey: process.env.GSD_SUPABASE_SERVICE_KEY,
      userEmail: process.env.GSD_USER_EMAIL,
      encryptionPassphrase: process.env.GSD_ENCRYPTION_PASSPHRASE,
    });
  } catch (error) {
    logger.error('Configuration error', error instanceof Error ? error : new Error(String(error)));
    logger.info('Required environment variables: GSD_SUPABASE_URL, GSD_SUPABASE_SERVICE_KEY, GSD_USER_EMAIL | Optional: GSD_ENCRYPTION_PASSPHRASE');
    logger.info('Run setup wizard with: npx gsd-mcp-server --setup');
    throw error;
  }
}

/**
 * Check if configuration is valid without throwing
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
  hasSupabaseUrl: boolean;
  hasServiceKey: boolean;
  hasUserEmail: boolean;
  hasEncryptionPassphrase: boolean;
  isValid: boolean;
} {
  return {
    hasSupabaseUrl: !!process.env.GSD_SUPABASE_URL,
    hasServiceKey: !!process.env.GSD_SUPABASE_SERVICE_KEY,
    hasUserEmail: !!process.env.GSD_USER_EMAIL,
    hasEncryptionPassphrase: !!process.env.GSD_ENCRYPTION_PASSPHRASE,
    isValid: isConfigValid(),
  };
}
