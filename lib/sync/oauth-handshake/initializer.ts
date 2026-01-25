/**
 * OAuth handshake initialization
 * Handles module setup, event listeners, and existing result recovery
 */

import { OAUTH_CONFIG } from '@/lib/constants/sync';
import type { BroadcastPayload, OAuthHandshakeEvent } from './types';
import {
  STORAGE_KEY,
  RESULT_KEY,
  CHANNEL_NAME,
  storage,
  safeLocalStorage,
  processedStates,
  notifyListeners,
  isInitialized,
  setInitialized,
  setBroadcastChannel,
} from './state';
import { initiateHandshakeFetch } from './fetcher';

/**
 * Ensure the OAuth handshake module is initialized
 * Sets up event listeners and checks for existing results
 */
export function ensureInitialized(): void {
  if (isInitialized() || typeof window === 'undefined') return;
  setInitialized();

  initBroadcastChannel();
  setupEventListeners();
  recoverExistingResult();
}

/**
 * Initialize BroadcastChannel for cross-tab communication
 */
function initBroadcastChannel(): void {
  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener('message', (event) => {
        handleBroadcastPayload(event.data as BroadcastPayload);
      });
      setBroadcastChannel(channel);
    } catch (error) {
      console.warn('[OAuthHandshake] Failed to initialize BroadcastChannel:', error);
      setBroadcastChannel(null);
    }
  }
}

/**
 * Set up window event listeners
 */
function setupEventListeners(): void {
  window.addEventListener('message', handleMessageEvent);
  window.addEventListener('storage', handleStorageEvent);
}

/**
 * Handle postMessage events
 * Validates origin to prevent cross-origin message injection attacks (CWE-346)
 */
function handleMessageEvent(event: MessageEvent): void {
  // Validate origin - only accept messages from same origin
  // OAuth callback page (public/oauth-callback.html) is hosted on same origin
  if (event.origin !== window.location.origin) {
    return;
  }

  if (!event.data || event.data.type !== 'oauth_handshake') return;
  handleBroadcastPayload(event.data as BroadcastPayload);
}

/**
 * Handle storage events (cross-tab communication fallback)
 */
function handleStorageEvent(event: StorageEvent): void {
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

/**
 * Handle incoming broadcast payload
 */
export function handleBroadcastPayload(payload: BroadcastPayload | null): void {
  if (!payload) return;

  // Handle error-only messages (e.g., when popup redirects to main app on OAuth failure)
  // These messages have success=false and error but may not have a state
  if (!payload.state && payload.success === false && payload.error) {
    console.info('[OAuthHandshake] Error-only broadcast received', {
      error: payload.error,
    });
    // Notify listeners with a generic error event using a placeholder state
    notifyListeners({
      status: 'error',
      state: '__error_only__',
      error: payload.error,
    });
    return;
  }

  // Regular state-based messages require a valid state
  if (!payload.state) return;

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

/**
 * Check for existing OAuth result in storage
 * Critical for PWA standalone mode where result may already be stored
 */
function recoverExistingResult(): void {
  try {
    // Try sessionStorage first (preferred for security)
    let existingResult = storage?.getItem(RESULT_KEY);
    let storageSource = 'sessionStorage';

    // Fall back to localStorage if not found in sessionStorage
    if (!existingResult) {
      existingResult = safeLocalStorage?.getItem(RESULT_KEY) ?? null;
      storageSource = 'localStorage';
    }

    if (existingResult) {
      processExistingResult(existingResult, storageSource);
    }
  } catch (error) {
    console.warn('[OAuthHandshake] Failed to check for existing result:', error);
  }
}

/**
 * Process an existing OAuth result from storage
 */
function processExistingResult(existingResult: string, storageSource: string): void {
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

    clearStoredResults();

    // Delay slightly to allow subscribers to register first
    setTimeout(() => {
      notifyListeners(result);
    }, OAUTH_CONFIG.LISTENER_REGISTRATION_DELAY_MS);
  }
}

/**
 * Clear OAuth results from both storage locations
 */
function clearStoredResults(): void {
  try {
    storage?.removeItem(RESULT_KEY);
    storage?.removeItem(STORAGE_KEY);
    safeLocalStorage?.removeItem(RESULT_KEY);
    safeLocalStorage?.removeItem(STORAGE_KEY);
    console.info('[OAuthHandshake] Cleared result from both storage locations');
  } catch (e) {
    console.warn('[OAuthHandshake] Failed to clear processed result from storage:', e);
  }
}
