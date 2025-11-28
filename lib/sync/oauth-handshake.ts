"use client";

/**
 * OAuth handshake utilities - Re-export layer
 *
 * This file provides backward compatibility for existing imports.
 * The actual implementation has been modularized into:
 * - oauth-handshake/types.ts - Type definitions
 * - oauth-handshake/state.ts - State management
 * - oauth-handshake/fetcher.ts - OAuth result fetching
 * - oauth-handshake/broadcaster.ts - Multi-channel broadcasting
 * - oauth-handshake/initializer.ts - Module initialization
 * - oauth-handshake/subscriber.ts - Event subscription
 *
 * @see lib/sync/oauth-handshake/index.ts for the main module entry point
 */

export type {
  OAuthAuthData,
  OAuthHandshakeSuccess,
  OAuthHandshakeError,
  OAuthHandshakeEvent,
} from './oauth-handshake/types';

export {
  subscribeToOAuthHandshake,
  retryOAuthHandshake,
} from './oauth-handshake/subscriber';

export { announceOAuthState } from './oauth-handshake/broadcaster';
