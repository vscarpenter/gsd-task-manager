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

function parseRetryAfterMs(value: string | null): number | null {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/**
 * Get or create an authenticated PocketBase client
 */
export function getPocketBase(config: GsdConfig): PocketBase {
  if (!pbInstance || pbUrl !== config.pocketBaseUrl) {
    pbInstance?.authStore.clear();
    pbInstance = new PocketBase(config.pocketBaseUrl);
    pbInstance.autoCancellation(false);
    pbInstance.afterSend = (response, data) => {
      if (response.status === 429 && data && typeof data === 'object') {
        const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
        if (retryAfterMs !== null) {
          (data as Record<string, unknown>).retryAfterMs = retryAfterMs;
        }
      }
      return data;
    };
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
