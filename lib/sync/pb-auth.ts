/**
 * PocketBase authentication helpers
 *
 * Wraps the PocketBase SDK's OAuth2 methods. The SDK handles the popup
 * window, token exchange, and localStorage persistence automatically.
 * This module adds device registration and a clean API for the UI layer.
 */

import { getPocketBase } from './pocketbase-client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_AUTH');

export type OAuthProvider = 'google' | 'github';
const DEFAULT_OAUTH_TIMEOUT_MS = 120_000;

/**
 * Runtime whitelist of OAuth providers. The `OAuthProvider` type is erased
 * at compile time, so a caller (XSS payload, console invocation, future
 * feature regression) could pass any string into `loginWithProvider`.
 * PocketBase will happily attempt OAuth with any provider configured on the
 * server — including potentially malicious ones added by an admin attacker.
 * Gating here ensures the SDK call only runs for providers we explicitly
 * support.
 */
const ALLOWED_OAUTH_PROVIDERS = new Set<OAuthProvider>(['google', 'github']);

export interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  email: string | null;
  provider: string | null;
}

export interface OAuthLoginOptions {
  popupWindow?: Window | null;
  requestKey?: string;
  timeoutMs?: number;
}

interface OAuthDiagnosticError {
  message?: string;
  status?: number;
  isAbort?: boolean;
  response?: {
    code?: number;
    message?: string;
  };
  originalError?: {
    message?: string;
  };
}

export function openOAuthPopup(provider: OAuthProvider): Window | null {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return null;
  }

  const width = Math.min(1024, window.innerWidth || 1024);
  const height = Math.min(768, window.innerHeight || 768);
  const left = Math.max(0, Math.round((window.innerWidth - width) / 2));
  const top = Math.max(0, Math.round((window.innerHeight - height) / 2));
  const features = [
    `width=${width}`,
    `height=${height}`,
    `top=${top}`,
    `left=${left}`,
    'resizable',
    'menubar=no',
  ].join(',');

  return window.open('about:blank', `gsd_oauth_${provider}`, features);
}

function closeOAuthPopup(popupWindow?: Window | null): void {
  try {
    popupWindow?.close?.();
  } catch {
    // Some mobile browsers do not allow closing OAuth browser contexts — expected, not an error.
    logger.debug("Could not close OAuth popup window — expected on some mobile browsers");
  }
}

export function cancelOAuthLogin(requestKey: string): void {
  if (!requestKey) return;
  getPocketBase().cancelRequest(requestKey);
}

export function getOAuthErrorMessage(error: unknown): string {
  const diagnostic = error as OAuthDiagnosticError;

  if (diagnostic?.isAbort) {
    return 'OAuth sign-in was cancelled. Please try again.';
  }

  return (
    diagnostic?.response?.message ||
    diagnostic?.originalError?.message ||
    diagnostic?.message ||
    'OAuth sign-in failed. Please try again.'
  );
}

/**
 * Initiate OAuth login via PocketBase SDK
 *
 * Opens a popup window for the chosen provider. The SDK handles the full
 * OAuth2 flow (redirect, code exchange, token storage) automatically.
 * Returns the authenticated user record on success.
 */
export async function loginWithProvider(
  provider: OAuthProvider,
  options: OAuthLoginOptions = {}
): Promise<AuthState> {
  if (!provider || !ALLOWED_OAUTH_PROVIDERS.has(provider)) {
    throw new Error(
      `OAuth provider not allowed: ${String(provider)}. Allowed providers: ${[...ALLOWED_OAUTH_PROVIDERS].join(', ')}`
    );
  }

  const pb = getPocketBase();
  const timeoutMs = options.timeoutMs ?? DEFAULT_OAUTH_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const authOptions = {
      provider,
      ...(options.popupWindow
        ? {
            urlCallback: (url: string) => {
              if (options.popupWindow?.closed) {
                throw new Error('OAuth sign-in window was closed before authentication started.');
              }
              options.popupWindow!.location.href = url;
            },
          }
        : {}),
      ...(options.requestKey ? { requestKey: options.requestKey } : {}),
    };

    const oauthPromise = pb.collection('users').authWithOAuth2(authOptions);

    const timeoutPromise = new Promise<never>((_, reject) => {
      if (timeoutMs <= 0) return;
      timeoutId = setTimeout(() => {
        if (options.requestKey) {
          pb.cancelRequest(options.requestKey);
        }
        reject(new Error('OAuth sign-in timed out. Please close the sign-in page and try again.'));
      }, timeoutMs);
    });

    const authData = await Promise.race([oauthPromise, timeoutPromise]);

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
    const diagnostic = error as OAuthDiagnosticError;
    logger.error('OAuth login failed', error instanceof Error ? error : new Error(String(error)), {
      provider,
      status: diagnostic?.status,
      type: diagnostic?.isAbort ? 'abort' : 'oauth',
    });
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    closeOAuthPopup(options.popupWindow);
  }
}

/** Convenience wrapper for Google OAuth */
export function loginWithGoogle(options?: OAuthLoginOptions): Promise<AuthState> {
  return loginWithProvider('google', options);
}

/** Convenience wrapper for GitHub OAuth */
export function loginWithGithub(options?: OAuthLoginOptions): Promise<AuthState> {
  return loginWithProvider('github', options);
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
    logger.debug('Auth token refreshed successfully');
    return true;
  } catch (error) {
    logger.warn('Auth token refresh failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Ensure there's a usable auth session for a background operation.
 *
 * Background sync, the health monitor, and fullSync historically only checked
 * `authStore.isValid`, which flips false the instant the JWT's exp passes —
 * even though PocketBase can still mint a fresh token from the server session.
 * This attempts that silent refresh so a merely-expired token doesn't surface
 * as "not authenticated" until the user manually re-auths.
 *
 * Checks `isValid` first so a healthy session never triggers a redundant
 * network refresh. Returns true when the session is (or becomes) valid.
 */
export async function ensureValidAuth(): Promise<boolean> {
  const pb = getPocketBase();
  if (pb.authStore.isValid) return true;
  if (!pb.authStore.token) return false;
  return refreshAuth();
}
