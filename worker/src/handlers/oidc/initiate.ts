import type { Env } from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { GOOGLE_CONFIG, APPLE_CONFIG, TTL, OAUTH_COOKIE, isOriginAllowed } from '../../config';
import { createLogger } from '../../utils/logger';
import { generateRandomString, generateCodeChallenge } from './helpers';
import { createCookie } from '../../utils/cookies';

const logger = createLogger('OIDC:Initiate');

/**
 * Initiate OAuth flow
 * GET /api/auth/oauth/:provider/start
 */
export async function initiateOAuth(
  request: Request,
  env: Env,
  provider: 'google' | 'apple'
): Promise<Response> {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigin = requestOrigin && isOriginAllowed(requestOrigin, env.ENVIRONMENT) ? requestOrigin : null;

  try {
    const config = provider === 'google' ? GOOGLE_CONFIG : APPLE_CONFIG;
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID;

    if (!clientId) {
      return errorResponse(`${provider} OAuth not configured`, 500, allowedOrigin || undefined);
    }

    // Determine the worker's callback URI (where OAuth provider redirects)
    // In development: http://localhost:8787/api/auth/oauth/callback
    // In production: https://gsd-api.vinny.dev/api/auth/oauth/callback
    const requestUrl = new URL(request.url);
    const workerOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
    const workerCallbackUri = `${workerOrigin}/api/auth/oauth/callback`;

    // Determine the app origin (where we'll redirect after processing)
    // Use OAUTH_CALLBACK_BASE if set, otherwise use Origin header
    const trustedAppOrigin =
      env.OAUTH_CALLBACK_BASE ||
      allowedOrigin ||
      env.OAUTH_REDIRECT_URI.replace('/oauth-callback.html', '');

    // Generate state and PKCE verifier
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const sessionId = crypto.randomUUID();

    // Store state, verifier, and app origin in KV (short-lived)
    await env.KV.put(
      `oauth_state:${state}`,
      JSON.stringify({
        codeVerifier,
        provider,
        redirectUri: workerCallbackUri,
        appOrigin: trustedAppOrigin,
        sessionId,
        createdAt: Date.now(),
      }),
      { expirationTtl: TTL.OAUTH_STATE }
    );

    // Build authorization URL
    const authUrl = new URL(config.authorization_endpoint);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', workerCallbackUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scope);

    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    if (provider === 'apple') {
      authUrl.searchParams.set('response_mode', 'form_post');
    }

    logger.info('OAuth flow initiated', {
      provider,
      state,
      workerCallbackUri,
      appOrigin: trustedAppOrigin,
      origin: allowedOrigin || 'default',
      requestUrl: request.url,
      headers: {
        origin: request.headers.get('Origin'),
        referer: request.headers.get('Referer'),
        host: request.headers.get('Host'),
        xForwardedHost: request.headers.get('X-Forwarded-Host'),
        xForwardedProto: request.headers.get('X-Forwarded-Proto'),
        cloudFrontForwardedProto: request.headers.get('CloudFront-Forwarded-Proto'),
        cloudFrontViewerCountry: request.headers.get('CloudFront-Viewer-Country')
      }
    });

    const response = jsonResponse({
      authUrl: authUrl.toString(),
      state,
    }, 200, allowedOrigin || undefined);

    const cookie = createCookie(OAUTH_COOKIE.name, sessionId, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: requestUrl.protocol === 'https:',
      maxAge: OAUTH_COOKIE.maxAge,
    });
    response.headers.append('Set-Cookie', cookie);

    return response;
  } catch (error: unknown) {
    logger.error('OAuth initiation failed', error as Error, { provider });
    return errorResponse('Failed to initiate OAuth', 500, allowedOrigin || undefined);
  }
}
