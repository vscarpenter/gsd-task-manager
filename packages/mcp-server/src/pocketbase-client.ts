/**
 * PocketBase client for MCP server
 *
 * Creates an authenticated PocketBase instance using the auth token
 * from the MCP server configuration.
 */

import PocketBase from 'pocketbase';
import type { GsdConfig } from './types.js';

let pbInstance: PocketBase | null = null;
let pbUrl = '';
let pbToken = '';

/**
 * Get or create an authenticated PocketBase client
 */
export function getPocketBase(config: GsdConfig): PocketBase {
  if (!pbInstance || pbUrl !== config.pocketBaseUrl) {
    pbInstance?.authStore.clear();
    pbInstance = new PocketBase(config.pocketBaseUrl);
    pbInstance.autoCancellation(false);
    pbUrl = config.pocketBaseUrl;
    pbToken = '';
  }

  // A long-lived MCP process can be reconfigured without restarting. Never
  // retain one principal's auth state when the configured bearer token changes.
  if (config.authToken !== pbToken) {
    if (pbToken) pbInstance.authStore.clear();
    if (config.authToken) pbInstance.authStore.save(config.authToken, null);
    pbToken = config.authToken;
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
  pbUrl = '';
  pbToken = '';
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
