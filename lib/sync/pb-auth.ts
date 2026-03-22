/**
 * PocketBase authentication helpers
 *
 * Wraps the PocketBase SDK's OAuth2 methods. The SDK handles the popup
 * window, token exchange, and localStorage persistence automatically.
 * This module adds device registration and a clean API for the UI layer.
 */

import { getPocketBase, clearPocketBase, isAuthenticated } from './pocketbase-client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_AUTH');

export type OAuthProvider = 'google' | 'github';

export interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  email: string | null;
  provider: string | null;
}

/**
 * Initiate OAuth login via PocketBase SDK
 *
 * Opens a popup window for the chosen provider. The SDK handles the full
 * OAuth2 flow (redirect, code exchange, token storage) automatically.
 * Returns the authenticated user record on success.
 */
export async function loginWithProvider(provider: OAuthProvider): Promise<AuthState> {
  const pb = getPocketBase();

  try {
    const authData = await pb.collection('users').authWithOAuth2({ provider });

    logger.info('OAuth login successful', {
      provider,
      userId: authData.record.id,
    });

    return {
      isLoggedIn: true,
      userId: authData.record.id,
      email: authData.record.email,
      provider,
    };
  } catch (error) {
    logger.error('OAuth login failed', error instanceof Error ? error : new Error(String(error)), {
      provider,
    });
    throw error;
  }
}

/** Convenience wrapper for Google OAuth */
export function loginWithGoogle(): Promise<AuthState> {
  return loginWithProvider('google');
}

/** Convenience wrapper for GitHub OAuth */
export function loginWithGithub(): Promise<AuthState> {
  return loginWithProvider('github');
}

/**
 * Log out the current user
 * Clears the PocketBase auth store and destroys the client singleton.
 */
export function logout(): void {
  logger.info('User logging out');
  clearPocketBase();
}

/**
 * Check if a user is currently logged in with a valid token
 */
export function isLoggedIn(): boolean {
  return isAuthenticated();
}

/**
 * Attempt to refresh the auth token.
 *
 * PocketBase JWTs expire client-side, but the server session may still be
 * valid. This calls the server to exchange the current (possibly expired)
 * token for a fresh one. Returns true if the refresh succeeded.
 */
export async function refreshAuth(): Promise<boolean> {
  const pb = getPocketBase();

  // Nothing to refresh if there's no token at all
  if (!pb.authStore.token) return false;

  try {
    await pb.collection('users').authRefresh();
    logger.info('Auth token refreshed successfully');
    return true;
  } catch (error) {
    logger.warn('Auth token refresh failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get current auth state snapshot
 */
export function getAuthState(): AuthState {
  const pb = getPocketBase();

  if (!pb.authStore.isValid || !pb.authStore.record) {
    return { isLoggedIn: false, userId: null, email: null, provider: null };
  }

  return {
    isLoggedIn: true,
    userId: pb.authStore.record.id,
    email: pb.authStore.record.email,
    provider: null, // PocketBase doesn't expose provider on the auth store
  };
}

/**
 * Subscribe to auth state changes (login / logout / token refresh)
 * Returns an unsubscribe function.
 */
export function onAuthChange(callback: (state: AuthState) => void): () => void {
  const pb = getPocketBase();

  const unsubscribe = pb.authStore.onChange(() => {
    callback(getAuthState());
  });

  return unsubscribe;
}
