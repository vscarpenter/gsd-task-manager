/**
 * PocketBase client for MCP server
 *
 * Creates an authenticated PocketBase instance using the auth token
 * from the MCP server configuration.
 */

import PocketBase from 'pocketbase';
import type { GsdConfig } from './types.js';

let pbInstance: PocketBase | null = null;

/**
 * Get or create an authenticated PocketBase client
 */
export function getPocketBase(config: GsdConfig): PocketBase {
  if (!pbInstance) {
    pbInstance = new PocketBase(config.pocketBaseUrl);
    pbInstance.autoCancellation(false);
  }

  // Ensure auth token is set
  if (config.authToken && !pbInstance.authStore.isValid) {
    // Manually set the auth token from config
    // The token comes from the user's browser session
    pbInstance.authStore.save(config.authToken, null);
  }

  return pbInstance;
}

/**
 * Clear the PocketBase instance (for testing)
 */
export function clearPocketBase(): void {
  if (pbInstance) {
    pbInstance.authStore.clear();
  }
  pbInstance = null;
}

/**
 * Get the current user's ID from the auth store
 */
export function getCurrentUserId(config: GsdConfig): string {
  const pb = getPocketBase(config);
  const model = pb.authStore.record;
  if (!model?.id) {
    throw new Error('Not authenticated — no user ID available');
  }
  return model.id;
}
