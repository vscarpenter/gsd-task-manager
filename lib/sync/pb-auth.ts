/**
 * PocketBase authentication helpers
 *
 * Signs in with the OAuth2 manual code flow, the same flow the iOS and
 * Android clients use: this tab holds `state` and the PKCE verifier, the
 * callback page relays `code` back (see ./oauth-callback), and the SDK
 * exchanges it and persists the session in localStorage. The SDK's realtime
 * `authWithOAuth2({ provider })` form is not used: it delivers the code to
 * whichever realtime client the `state` names, so a crafted provider link
 * could hand a victim's code to an attacker.
 */

import { getPocketBase } from './pocketbase-client';
import { OAUTH_REDIRECT_PATH, waitForOAuthCallback } from './oauth-callback';
import { createLogger } from '@/lib/logger';
import { isTransientSyncFailure } from './error-categorizer';
import { isTokenExpired } from 'pocketbase';

const logger = createLogger('SYNC_AUTH');

export type OAuthProvider = 'google' | 'github' | 'apple';
const DEFAULT_OAUTH_TIMEOUT_MS = 120_000;
const AUTH_REFRESH_THRESHOLD_SECONDS = 5 * 60;

/**
 * Runtime whitelist of OAuth providers. The `OAuthProvider` type is erased
 * at compile time, so a caller (XSS payload, console invocation, future
 * feature regression) could pass any string into `loginWithProvider`.
 * PocketBase will happily attempt OAuth with any provider configured on the
 * server — including potentially malicious ones added by an admin attacker.
 * Gating here ensures the SDK call only runs for providers we explicitly
 * support.
 */
const ALLOWED_OAUTH_PROVIDERS = new Set<OAuthProvider>(['google', 'github', 'apple']);

/** In-flight sign-ins by request key, so cancelOAuthLogin can stop the callback wait. */
const pendingLogins = new Map<string, AbortController>();

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
  // A provider that serves Cross-Origin-Opener-Policy: same-origin — accounts.google.com
  // does — swaps the browsing context group when the popup navigates to it, severing this
  // handle. The browser then reports the popup as closed and refuses close(), logging a
  // COOP violation for a call that could not have done anything. Such a popup closes
  // itself from its own final page, so skipping the call loses no cleanup. Providers that
  // send no COOP, such as GitHub, keep the handle live and are still closed here.
  if (!popupWindow || popupWindow.closed) {
    return;
  }

  try {
    popupWindow.close?.();
  } catch {
    // Some mobile browsers do not allow closing OAuth browser contexts — expected, not an error.
    logger.debug("Could not close OAuth popup window — expected on some mobile browsers");
  }
}

export function cancelOAuthLogin(requestKey: string): void {
  if (!requestKey) return;
  pendingLogins.get(requestKey)?.abort(
    Object.assign(new Error('OAuth sign-in was cancelled.'), { isAbort: true })
  );
  getPocketBase().cancelRequest(requestKey);
}

function openProviderPage(url: string, popupWindow?: Window | null): void {
  if (popupWindow) {
    if (popupWindow.closed) {
      throw new Error('OAuth sign-in window was closed before authentication started.');
    }
    popupWindow.location.href = url;
    return;
  }

  if (!window.open(url, '_blank')) {
    throw new Error('Allow pop-ups for this site to sign in.');
  }
}

async function runCodeFlow(
  provider: OAuthProvider,
  options: OAuthLoginOptions,
  signal: AbortSignal
) {
  const pb = getPocketBase();
  const requestOptions = options.requestKey ? { requestKey: options.requestKey } : {};

  const methods = await pb.collection('users').listAuthMethods(requestOptions);
  const providerInfo = methods.oauth2?.providers?.find((p) => p.name === provider);
  if (!providerInfo) {
    throw new Error(`OAuth provider is not configured on the server: ${provider}`);
  }

  const redirectUrl = pb.buildURL(OAUTH_REDIRECT_PATH);
  const callback = waitForOAuthCallback(providerInfo.state, signal);
  try {
    openProviderPage(providerInfo.authURL + encodeURIComponent(redirectUrl), options.popupWindow);
  } catch (error) {
    // loginWithProvider's cleanup aborts the wait; this keeps that rejection handled.
    callback.catch(() => {});
    throw error;
  }
  const code = await callback;

  return pb
    .collection('users')
    .authWithOAuth2Code(provider, code, providerInfo.codeVerifier, redirectUrl, undefined, requestOptions);
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
 * Cancel and timeout handling for one sign-in. Aborting, by cancelOAuthLogin
 * or the timeout, rejects `aborted` with the reason.
 */
function trackLogin(options: OAuthLoginOptions) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_OAUTH_TIMEOUT_MS;
  if (options.requestKey) {
    pendingLogins.set(options.requestKey, controller);
  }

  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {
      once: true,
    });
  });
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          if (options.requestKey) {
            getPocketBase().cancelRequest(options.requestKey);
          }
          controller.abort(
            new Error('OAuth sign-in timed out. Please close the sign-in page and try again.')
          );
        }, timeoutMs)
      : undefined;

  const dispose = () => {
    clearTimeout(timeoutId);
    if (options.requestKey) {
      pendingLogins.delete(options.requestKey);
    }
    // Closes the callback channel if sign-in ended before a code arrived.
    controller.abort();
  };

  return { signal: controller.signal, aborted, dispose };
}

/**
 * Initiate OAuth login with the manual code flow
 *
 * Sends the popup to the provider, waits for the callback page to relay the
 * code for this tab's `state`, then exchanges it. The SDK stores the session.
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

  const login = trackLogin(options);

  try {
    const authData = await Promise.race([
      runCodeFlow(provider, options, login.signal),
      login.aborted,
    ]);

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
    login.dispose();
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
 * Convenience wrapper for Sign in with Apple.
 *
 * The GSD iOS app has always offered Apple (App Store Guideline 4.8 requires it), and
 * this app did not — so a user who signed in with Apple there got a PocketBase account
 * the web could never reach, and sync looked broken rather than absent. Offering the same
 * three providers on both clients makes the choice recoverable instead of a one-way door.
 *
 * This does NOT merge accounts that are already split. Linking an Apple identity to an
 * existing Google/GitHub user by verified email is a PocketBase server setting.
 */
export function loginWithApple(options?: OAuthLoginOptions): Promise<AuthState> {
  return loginWithProvider('apple', options);
}



/**
 * How a token refresh ended. `unreachable` means the request failed for a
 * transient reason (offline, 429, 5xx), which says nothing about the session.
 */
export type AuthRefreshOutcome = 'refreshed' | 'no-session' | 'rejected' | 'unreachable';

/**
 * Attempt to refresh the auth token and report how it ended.
 *
 * PocketBase JWTs expire client-side, but the server session may still be
 * valid. This calls the server to exchange the current (possibly expired)
 * token for a fresh one.
 */
export async function refreshAuthOutcome(): Promise<AuthRefreshOutcome> {
  const pb = getPocketBase();

  // Nothing to refresh if there's no token at all
  if (!pb.authStore.token) return 'no-session';

  try {
    await pb.collection('users').authRefresh();
    logger.debug('Auth token refreshed successfully');
    return 'refreshed';
  } catch (error) {
    logger.warn('Auth token refresh failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return isTransientSyncFailure(error) ? 'unreachable' : 'rejected';
  }
}

/**
 * Attempt to refresh the auth token. Returns true if the refresh succeeded.
 */
export async function refreshAuth(): Promise<boolean> {
  return (await refreshAuthOutcome()) === 'refreshed';
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
  if (!pb.authStore.token) return false;
  if (
    pb.authStore.isValid &&
    !isTokenExpired(pb.authStore.token, AUTH_REFRESH_THRESHOLD_SECONDS)
  ) {
    return true;
  }
  return refreshAuth();
}
