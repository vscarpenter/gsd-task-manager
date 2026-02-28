import { z } from 'zod';
import type { GsdConfig } from '../types.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('CONFIG');

/**
 * Configuration schema for GSD MCP Server (PocketBase)
 */
export const configSchema = z.object({
  pocketBaseUrl: z.string().url().refine(
    (url) => url.startsWith('https://') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'),
    { message: 'PocketBase URL must use HTTPS (except localhost for local development)' }
  ),
  authToken: z.string().min(1),
});

export type ConfigSchema = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): GsdConfig {
  try {
    return configSchema.parse({
      pocketBaseUrl: process.env.GSD_POCKETBASE_URL || process.env.GSD_API_URL,
      authToken: process.env.GSD_AUTH_TOKEN,
    });
  } catch (error) {
    logger.error('Configuration error', error instanceof Error ? error : new Error(String(error)));
    logger.info('Required environment variables: GSD_POCKETBASE_URL (or GSD_API_URL), GSD_AUTH_TOKEN');
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
  hasPocketBaseUrl: boolean;
  hasAuthToken: boolean;
  isValid: boolean;
} {
  return {
    hasPocketBaseUrl: !!(process.env.GSD_POCKETBASE_URL || process.env.GSD_API_URL),
    hasAuthToken: !!process.env.GSD_AUTH_TOKEN,
    isValid: isConfigValid(),
  };
}
