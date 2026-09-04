/**
 * PocketBase client for MCP server
 *
 * Creates an authenticated PocketBase instance using the auth token
 * from the MCP server configuration.
 */

import PocketBase from 'pocketbase';
import { redactPocketBaseHost } from './api/client.js';
import { SuperuserPrincipalError } from './errors.js';
import type { GsdConfig } from './types.js';

let pbInstance: PocketBase | null = null;
let pbUrl = '';
let pbToken = '';

/**
 * The only statuses in which PocketBase actually evaluated the principal and
 * refused it. Everything else — no HTTP response (SDK status 0), 429, 5xx, a
 * reverse-proxy 404 — says nothing about the token and must never retire it.
 * 404 is excluded deliberately: a proxy 404 is indistinguishable from a deleted
 * auth record, and wrongly discarding a working token is the worse failure.
 */
const PRINCIPAL_REJECTION_STATUSES: ReadonlySet<number> = new Set([401, 403]);

/** True only when PocketBase itself refused the principal. */
function isPrincipalRejection(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && PRINCIPAL_REJECTION_STATUSES.has(status);
}

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
    throw new SuperuserPrincipalError();
  }

  return pbInstance;
}

/**
 * Refuse a privileged principal using only the decoded token, so startup can
 * make this call without touching the network.
 */
export function assertNonSuperuserPrincipal(config: GsdConfig): void {
  getPocketBase(config);
}

function normalUserAuthError(): Error {
  return new Error(
    `Not authenticated as a normal users-collection account\n\n` +
      `Your auth token may be invalid, expired, or privileged.\n` +
      `Run the installed setup wizard again: gsd-mcp-server --setup`
  );
}

/**
 * PocketBase could not be reached, or answered with something that is not a
 * verdict about the principal. The configured token is untouched and the same
 * call can simply be retried, so this message must never advise rotating
 * credentials. The host is redacted so it is safe to paste into a chat.
 */
function unreachableError(config: GsdConfig, cause: unknown): Error {
  return new Error(
    `Cannot reach PocketBase at ${redactPocketBaseHost(config.pocketBaseUrl)}\n\n` +
      `Your saved credentials were not changed. Check your network or VPN and try again.\n` +
      `To diagnose the connection, run: gsd-mcp-server --validate`,
    { cause }
  );
}

/**
 * Hydrate and attest the configured PocketBase principal before any account-
 * scoped operation. Administrator/superuser tokens are never accepted.
 */
export async function requireUsersPrincipal(
  config: GsdConfig
): Promise<{ pb: PocketBase; ownerId: string }> {
  // getPocketBase has already refused a decoded superuser, offline.
  const pb = getPocketBase(config);

  if (!pb.authStore.record?.id && pb.authStore.token) {
    try {
      await pb.collection('users').authRefresh();
    } catch (error) {
      if (!isPrincipalRejection(error)) throw unreachableError(config, error);
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
