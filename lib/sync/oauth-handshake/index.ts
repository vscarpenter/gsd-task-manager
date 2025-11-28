/**
 * OAuth handshake module
 *
 * Unifies popup and redirect OAuth flows by broadcasting the OAuth state token
 * and fetching the authenticated session data from the worker.
 *
 * Module structure:
 * - types.ts: Type definitions
 * - state.ts: State management (listeners, processed states)
 * - fetcher.ts: OAuth result fetching from worker API
 * - broadcaster.ts: Multi-channel broadcasting for cross-tab/popup communication
 * - initializer.ts: Module initialization and event listener setup
 * - subscriber.ts: Public subscription API
 */

"use client";

// Re-export types
export type {
  OAuthAuthData,
  OAuthHandshakeSuccess,
  OAuthHandshakeError,
  OAuthHandshakeEvent,
} from './types';

// Re-export public API
export { subscribeToOAuthHandshake, retryOAuthHandshake } from './subscriber';
export { announceOAuthState } from './broadcaster';
