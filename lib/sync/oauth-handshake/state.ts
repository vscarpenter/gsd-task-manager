/**
 * OAuth handshake state management
 * Manages listeners, processed states, and pending fetches
 */

import type { OAuthHandshakeEvent } from './types';

/** Storage key for OAuth handshake state */
export const STORAGE_KEY = 'oauth_handshake_state';

/** Storage key for OAuth result */
export const RESULT_KEY = 'oauth_handshake_result';

/** BroadcastChannel name */
export const CHANNEL_NAME = 'oauth-handshake';

/** Registered event listeners */
export const listeners = new Set<(event: OAuthHandshakeEvent) => void>();

/** States that have already been processed (prevents duplicates) */
export const processedStates = new Set<string>();

/** Pending fetch promises by state */
export const pendingFetches = new Map<string, Promise<void>>();

/** Whether the module has been initialized */
let _isInitialized = false;

/** BroadcastChannel instance */
let _broadcastChannel: BroadcastChannel | null = null;

/** Storage instance (sessionStorage for security) */
export const storage = typeof window !== 'undefined' ? sessionStorage : null;

/**
 * Get initialization state
 */
export function isInitialized(): boolean {
  return _isInitialized;
}

/**
 * Mark as initialized
 */
export function setInitialized(): void {
  _isInitialized = true;
}

/**
 * Get BroadcastChannel instance
 */
export function getBroadcastChannel(): BroadcastChannel | null {
  return _broadcastChannel;
}

/**
 * Set BroadcastChannel instance
 */
export function setBroadcastChannel(channel: BroadcastChannel | null): void {
  _broadcastChannel = channel;
}

/**
 * Notify all registered listeners of an OAuth event
 */
export function notifyListeners(event: OAuthHandshakeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[OAuthHandshake] Listener threw an error:', error);
    }
  }
}
