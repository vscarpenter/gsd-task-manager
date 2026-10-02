/**
 * OAuth callback relay for the manual code flow.
 *
 * The server bounce at OAUTH_REDIRECT_PATH returns the browser to the
 * callback page with `code` and `state` in the URL fragment. That page may
 * have lost `window.opener` (accounts.google.com serves
 * Cross-Origin-Opener-Policy: same-origin), so it relays the result over a
 * same-origin BroadcastChannel instead of postMessage.
 *
 * Only the tab that started sign-in holds the matching `state` and the PKCE
 * verifier, so a code delivered for any other state is ignored. That binding
 * is what PocketBase's realtime `/api/oauth2-redirect` flow lacks: it hands
 * the code to whichever realtime client the `state` names.
 */

export const OAUTH_CALLBACK_CHANNEL = 'gsd-oauth-callback';

/** Server bounce that turns any provider return (GET or Apple's form_post) into a GET to /auth/callback/. */
export const OAUTH_REDIRECT_PATH = '/api/gsd/oauth-callback';

const MAX_PARAM_LENGTH = 2048;

export interface OAuthCallbackMessage {
  state: string;
  code?: string;
  error?: string;
}

function boundedParam(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name);
  if (!value || value.length > MAX_PARAM_LENGTH) return undefined;
  return value;
}

export function parseOAuthCallback(search: string): OAuthCallbackMessage | null {
  const params = new URLSearchParams(search);
  const state = boundedParam(params, 'state');
  if (!state) return null;

  const code = boundedParam(params, 'code');
  const error = boundedParam(params, 'error');
  return {
    state,
    ...(code ? { code } : {}),
    ...(error ? { error } : {}),
  };
}

/**
 * Called by the callback page with its URL fragment (without the `#`).
 * Returns false when there is nothing to relay.
 */
export function relayOAuthCallback(fragment: string): boolean {
  const message = parseOAuthCallback(fragment);
  if (!message || typeof BroadcastChannel === 'undefined') return false;

  const channel = new BroadcastChannel(OAUTH_CALLBACK_CHANNEL);
  channel.postMessage(message);
  channel.close();
  return true;
}

/**
 * Resolves with the authorization code once the callback page relays a
 * message for `expectedState`. Messages for any other state are ignored.
 * Rejects with `signal.reason` when the signal aborts (cancel or timeout).
 */
export function waitForOAuthCallback(expectedState: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof BroadcastChannel === 'undefined') {
      reject(new Error('This browser cannot complete sign-in: BroadcastChannel is unavailable.'));
      return;
    }
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const channel = new BroadcastChannel(OAUTH_CALLBACK_CHANNEL);
    const finish = () => {
      channel.close();
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      finish();
      reject(signal.reason);
    };

    channel.onmessage = (event: MessageEvent<OAuthCallbackMessage>) => {
      const message = event.data;
      if (!message || message.state !== expectedState) return;

      finish();
      if (message.error || !message.code) {
        reject(new Error(`OAuth sign-in failed: ${message.error ?? 'no authorization code returned'}`));
        return;
      }
      resolve(message.code);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
