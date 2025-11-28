/**
 * OAuth state broadcasting
 * Handles multi-channel communication for OAuth state
 */

import type { BroadcastPayload } from './types';
import {
  STORAGE_KEY,
  RESULT_KEY,
  storage,
  processedStates,
  notifyListeners,
  getBroadcastChannel,
} from './state';
import { fetchOAuthResult } from './fetcher';

/**
 * Broadcast OAuth state to all channels (used by OAuth callback page)
 */
export function announceOAuthState(state: string, success: boolean, error?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  (async () => {
    const payload: BroadcastPayload = {
      type: 'oauth_handshake',
      state,
      success,
      error: error || null,
      timestamp: Date.now(),
    };

    const result = await fetchOAuthResult(state);
    processedStates.add(state);

    payload.result = result;

    // Store result in sessionStorage for same-tab recovery
    storeResult(result);

    // Broadcast via BroadcastChannel for cross-tab communication
    broadcastViaChannel(payload);

    // Post to opener window for popup flows
    postToOpener(payload);

    // Store payload for storage event listeners
    storePayload(payload);

    notifyListeners(result);
  })().catch((err) => {
    console.error('[OAuthHandshake] Failed to broadcast handshake result:', err);
    // Notify listeners so they can show error feedback to user
    notifyListeners({
      status: 'error',
      state,
      error: 'Failed to complete OAuth handshake. Please try again.',
    });
  });
}

/**
 * Store OAuth result in sessionStorage
 */
function storeResult(result: unknown): void {
  try {
    storage?.setItem(RESULT_KEY, JSON.stringify(result));
  } catch (err) {
    console.warn('[OAuthHandshake] Failed to write handshake result to storage:', err);
  }
}

/**
 * Broadcast via BroadcastChannel
 */
function broadcastViaChannel(payload: BroadcastPayload): void {
  try {
    const channel = getBroadcastChannel();
    if (channel) {
      channel.postMessage(payload);
    }
  } catch (err) {
    console.warn('[OAuthHandshake] Failed to post via BroadcastChannel:', err);
  }
}

/**
 * Post message to opener window (for popup flows)
 */
function postToOpener(payload: BroadcastPayload): void {
  if (window.opener && typeof window.opener.postMessage === 'function') {
    try {
      window.opener.postMessage(payload, window.location.origin);
    } catch (err) {
      console.warn('[OAuthHandshake] Failed to postMessage to opener:', err);
    }
  }
}

/**
 * Store payload in sessionStorage for storage event listeners
 */
function storePayload(payload: BroadcastPayload): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[OAuthHandshake] Failed to write localStorage payload:', err);
  }
}
