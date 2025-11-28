import type { Env } from '../../types';
import { jsonResponse } from '../../middleware/cors';
import { TTL } from '../../config';

/**
 * Build redirect response for successful OAuth callback
 */
export function buildSuccessRedirect(appOrigin: string, state: string): Response {
  const redirectUrl = new URL('/oauth-callback.html', appOrigin);
  redirectUrl.searchParams.set('success', 'true');
  redirectUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  });
}

/**
 * Build JSON response for successful OAuth callback (fallback when no appOrigin)
 */
export function buildSuccessJson(state: string, origin: string | null): Response {
  return jsonResponse({ status: 'success', state }, 200, origin);
}

/**
 * Build redirect response for failed OAuth callback
 */
export function buildErrorRedirect(redirectTarget: string, state: string, message: string): Response {
  const redirectUrl = new URL('/oauth-callback.html', redirectTarget);
  redirectUrl.searchParams.set('success', 'false');
  redirectUrl.searchParams.set('state', state);
  redirectUrl.searchParams.set('error', encodeURIComponent(message));

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  });
}

/**
 * Build JSON response for failed OAuth callback
 */
export function buildErrorJson(
  error: unknown,
  origin: string | null,
  env: Env
): Response {
  const message = error instanceof Error ? error.message : 'OAuth callback failed';

  return jsonResponse(
    {
      error: 'OAuth callback failed',
      message: env.ENVIRONMENT === 'development' ? message : 'OAuth authentication failed',
      ...(env.ENVIRONMENT === 'development' &&
        error instanceof Error && {
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        }),
    },
    500,
    origin
  );
}

interface ErrorContext {
  appOrigin: string | null;
  sessionId: string | null;
}

/**
 * Retrieve error context from OAuth state in KV
 */
export async function getErrorContext(state: string, env: Env): Promise<ErrorContext> {
  try {
    const stateDataStr = await env.KV.get(`oauth_state:${state}`);
    if (stateDataStr) {
      const stateData = JSON.parse(stateDataStr);
      return {
        appOrigin: stateData.appOrigin || null,
        sessionId: stateData.sessionId || null,
      };
    }
  } catch {
    // Ignore errors when trying to retrieve state
  }

  return { appOrigin: null, sessionId: null };
}

/**
 * Store error result in KV for later retrieval
 */
export async function storeErrorResult(
  state: string,
  message: string,
  appOrigin: string | null,
  sessionId: string | null,
  env: Env
): Promise<void> {
  await env.KV.put(
    `oauth_result:${state}`,
    JSON.stringify({
      status: 'error',
      error: message,
      appOrigin,
      sessionId,
      createdAt: Date.now(),
    }),
    { expirationTtl: TTL.OAUTH_STATE }
  );
}
