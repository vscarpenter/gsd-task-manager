"use client";

/**
 * OAuth handshake utilities
 * Unifies popup and redirect flows by broadcasting the OAuth state token
 * and fetching the authenticated session data from the worker.
 */

import { toast } from 'sonner';
import { ENV_CONFIG } from '@/lib/env-config';
import { OAUTH_CONFIG } from '@/lib/constants/sync';

export interface OAuthAuthData {
  userId: string;
  deviceId: string;
  email: string;
  token: string;
  expiresAt: number;
  requiresEncryptionSetup?: boolean;
  encryptionSalt?: string;
  provider: string;
}

export interface OAuthHandshakeSuccess {
  status: 'success';
  state: string;
  authData: OAuthAuthData;
}

export interface OAuthHandshakeError {
  status: 'error';
  state: string;
  error: string;
}

export type OAuthHandshakeEvent = OAuthHandshakeSuccess | OAuthHandshakeError;

interface BroadcastPayload {
  type: 'oauth_handshake';
  state: string;
  success: boolean;
  error?: string | null;
  timestamp: number;
  result?: OAuthHandshakeEvent;
}

const STORAGE_KEY = 'oauth_handshake_state';
const RESULT_KEY = 'oauth_handshake_result';
const CHANNEL_NAME = 'oauth-handshake';

// Use sessionStorage instead of localStorage for better security
// sessionStorage is cleared when the browser tab is closed, reducing XSS attack surface
const storage = typeof window !== 'undefined' ? sessionStorage : null;

const listeners = new Set<(event: OAuthHandshakeEvent) => void>();
const processedStates = new Set<string>();
const pendingFetches = new Map<string, Promise<void>>();

let isInitialized = false;
let broadcastChannel: BroadcastChannel | null = null;

function ensureInitialized() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  if ('BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.addEventListener('message', (event) => {
        handleBroadcastPayload(event.data as BroadcastPayload);
      });
    } catch (error) {
      // Keep as console.warn since this is UI/browser capability warning
      console.warn('[OAuthHandshake] Failed to initialize BroadcastChannel:', error);
      broadcastChannel = null;
    }
  }

  window.addEventListener('message', handleMessageEvent);
  window.addEventListener('storage', handleStorageEvent);

  // Check for existing OAuth result in storage (critical for PWA standalone mode)
  // After OAuth callback redirects back to the app, the result is already in storage
  // but nobody has read it yet
  // IMPORTANT: Check BOTH sessionStorage AND localStorage because:
  // - oauth-callback.html stores in localStorage (for PWA cross-page persistence)
  // - This handler uses sessionStorage by default (for security)
  // - iOS PWA standalone mode may clear sessionStorage on redirect
  try {
    // Try sessionStorage first (preferred for security)
    let existingResult = storage?.getItem(RESULT_KEY);
    let storageSource = 'sessionStorage';

    // Fall back to localStorage if not found in sessionStorage
    if (!existingResult && typeof window !== 'undefined') {
      existingResult = localStorage.getItem(RESULT_KEY);
      storageSource = 'localStorage';
    }

    if (existingResult) {
      console.info(`[OAuthHandshake] Found existing result in ${storageSource} on init`);
      const result = JSON.parse(existingResult) as OAuthHandshakeEvent;

      // Only process if we haven't already processed this state
      if (!processedStates.has(result.state)) {
        console.info('[OAuthHandshake] Processing existing result', {
          state: result.state.substring(0, 8) + '...',
          status: result.status,
          source: storageSource,
        });
        processedStates.add(result.state);

        // Clear the result from BOTH storage locations to prevent duplicate processing
        try {
          storage?.removeItem(RESULT_KEY);
          storage?.removeItem(STORAGE_KEY);
          localStorage.removeItem(RESULT_KEY);
          localStorage.removeItem(STORAGE_KEY);
          console.info('[OAuthHandshake] Cleared result from both storage locations');
        } catch (e) {
          console.warn('[OAuthHandshake] Failed to clear processed result from storage:', e);
        }

        // Delay slightly to allow subscribers to register first
        setTimeout(() => {
          notifyListeners(result);
        }, OAUTH_CONFIG.LISTENER_REGISTRATION_DELAY_MS);
      }
    }
  } catch (error) {
    console.warn('[OAuthHandshake] Failed to check for existing result:', error);
  }
}

function handleMessageEvent(event: MessageEvent) {
  if (!event.data || event.data.type !== 'oauth_handshake') return;

  handleBroadcastPayload(event.data as BroadcastPayload);
}

function handleStorageEvent(event: StorageEvent) {
  if (!event.newValue) return;

  try {
    if (event.key === STORAGE_KEY) {
      const payload = JSON.parse(event.newValue) as BroadcastPayload;
      handleBroadcastPayload(payload);
    } else if (event.key === RESULT_KEY) {
      const result = JSON.parse(event.newValue) as OAuthHandshakeEvent;
      if (!processedStates.has(result.state)) {
        processedStates.add(result.state);
        notifyListeners(result);
      }
    }
  } catch (error) {
    console.warn('[OAuthHandshake] Failed to parse storage payload:', error);
  }
}

function handleBroadcastPayload(payload: BroadcastPayload | null) {
  if (!payload || !payload.state) return;

  // Ignore duplicate notifications
  if (processedStates.has(payload.state)) {
    console.debug('[OAuthHandshake] Duplicate state ignored', payload.state.substring(0, 8) + '...');
    return;
  }

  console.info('[OAuthHandshake] Broadcast received', {
    state: payload.state.substring(0, 8) + '...',
    success: payload.success,
  });

  if (payload.result && !processedStates.has(payload.state)) {
    processedStates.add(payload.state);
    notifyListeners(payload.result);
    return;
  }

  initiateHandshakeFetch(payload.state, payload.success, payload.error ?? undefined);
}

function notifyListeners(event: OAuthHandshakeEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[OAuthHandshake] Listener threw an error:', error);
    }
  }
}

async function fetchOAuthResult(state: string): Promise<OAuthHandshakeEvent> {
  try {
    const workerUrl = ENV_CONFIG.apiBaseUrl;

    console.info('[OAuthHandshake] Fetching result from worker', {
      state: state.substring(0, 8) + '...',
      workerUrl,
    });

    const response = await fetch(`${workerUrl}/api/auth/oauth/result?state=${encodeURIComponent(state)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[OAuthHandshake] Fetch failed', {
        state: state.substring(0, 8) + '...',
        status: response.status,
        body: data,
      });

      const message =
        (data && (data.message as string)) ||
        (response.status === 410 ? 'OAuth result expired. Please try again.' : 'Failed to complete OAuth.');

      return {
        status: 'error',
        state,
        error: message,
      };
    }

    if (data.status === 'success' && data.authData) {
      console.info('[OAuthHandshake] Result received', {
        state: state.substring(0, 8) + '...',
      });

      return {
        status: 'success',
        state,
        authData: data.authData as OAuthAuthData,
      };
    }

    const errorMessage =
      (data && (data.error as string)) ||
      (data && (data.message as string)) ||
      'OAuth failed. Please try again.';

    return {
      status: 'error',
      state,
      error: errorMessage,
    };
  } catch (error) {
    console.error('[OAuthHandshake] Fetch threw error', error);
    return {
      status: 'error',
      state,
      error: error instanceof Error ? error.message : 'Network error while completing OAuth.',
    };
  }
}

function initiateHandshakeFetch(state: string, wasSuccessful: boolean, initialError?: string) {
  if (processedStates.has(state) || pendingFetches.has(state)) {
    return;
  }

  const fetchPromise = (async () => {
    const result = await fetchOAuthResult(state);

    // If the worker result expired and we received an initial error message, surface it.
    if (result.status === 'error' && initialError && !result.error) {
      result.error = initialError;
    }

    processedStates.add(state);
    notifyListeners(result);
  })()
    .catch((error) => {
      processedStates.add(state);
      notifyListeners({
        status: 'error',
        state,
        error: error instanceof Error ? error.message : 'OAuth handshake failed.',
      });
    })
    .finally(() => {
      pendingFetches.delete(state);
    });

  pendingFetches.set(state, fetchPromise);
}

/**
 * Subscribe to OAuth handshake events.
 */
export function subscribeToOAuthHandshake(listener: (event: OAuthHandshakeEvent) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  ensureInitialized();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Broadcast OAuth state (used by OAuth callback page).
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

    try {
      storage?.setItem(RESULT_KEY, JSON.stringify(result));
    } catch (err) {
      console.warn('[OAuthHandshake] Failed to write handshake result to storage:', err);
    }

    try {
      if (broadcastChannel) {
        broadcastChannel.postMessage(payload);
      }
    } catch (err) {
      console.warn('[OAuthHandshake] Failed to post via BroadcastChannel:', err);
    }

    if (window.opener && typeof window.opener.postMessage === 'function') {
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch (err) {
        console.warn('[OAuthHandshake] Failed to postMessage to opener:', err);
      }
    }

    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[OAuthHandshake] Failed to write localStorage payload:', err);
    }

    notifyListeners(result);
  })().catch((err) => {
    console.error('[OAuthHandshake] Failed to broadcast handshake result:', err);
  });
}

/**
 * Convenience helper for manual retries/diagnostics.
 */
export async function retryOAuthHandshake(state: string): Promise<void> {
  if (processedStates.has(state)) {
    processedStates.delete(state);
  }
  initiateHandshakeFetch(state, true);
}

/**
 * Minimal helper to surface errors to user when listeners are not registered.
 * Keeps UX friendly if the app never subscribed.
 */
subscribeToOAuthHandshake((event) => {
  console.info('[OAuthHandshake] Event delivered to default listener', {
    status: event.status,
    state: event.state.substring(0, 8) + '...',
  });
  if (listeners.size <= 1) {
    if (event.status === 'error') {
      toast.error(event.error);
    }
  }
});
