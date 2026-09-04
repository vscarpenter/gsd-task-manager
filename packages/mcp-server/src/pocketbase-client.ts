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

  if (pbInstance.authStore.isSuperuser) {
    pbInstance.authStore.clear();
    pbToken = '';
    throw new Error('PocketBase superuser tokens are not accepted');
  }

  return pbInstance;
}

function normalUserAuthError(): Error {
  return new Error(
    `Not authenticated as a normal users-collection account\n\n` +
      `Your auth token may be invalid, expired, or privileged.\n` +
      `Run the installed setup wizard again: gsd-mcp-server --setup`
  );
}

/**
 * Hydrate and attest the configured PocketBase principal before any account-
 * scoped operation. Administrator/superuser tokens are never accepted.
 */
export async function requireUsersPrincipal(
  config: GsdConfig
): Promise<{ pb: PocketBase; ownerId: string }> {
  const pb = getPocketBase(config);
  if (pb.authStore.isSuperuser) {
    pb.authStore.clear();
    throw normalUserAuthError();
  }

  if (!pb.authStore.record?.id && pb.authStore.token) {
    try {
      await pb.collection('users').authRefresh();
    } catch {
      pb.authStore.clear();
      throw normalUserAuthError();
    }
  }

  const model = pb.authStore.record;
  if (pb.authStore.isSuperuser || !model?.id || model.collectionName !== 'users') {
    pb.authStore.clear();
    throw normalUserAuthError();
  }

  return { pb, ownerId: model.id };
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
  if (pb.authStore.isSuperuser || !model?.id || model.collectionName !== 'users') {
    throw normalUserAuthError();
  }
  return model.id;
}
