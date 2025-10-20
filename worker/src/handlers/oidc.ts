import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Env } from '../types';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { generateId } from '../utils/crypto';
import { createToken } from '../utils/jwt';
import { GOOGLE_CONFIG, APPLE_CONFIG, TTL } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('OIDC');

/**
 * Initiate OAuth flow
 * GET /api/auth/oauth/:provider/start
 */
export async function initiateOAuth(
  request: Request,
  env: Env,
  provider: 'google' | 'apple'
): Promise<Response> {
  const origin = request.headers.get('Origin');

  try {
    const config = provider === 'google' ? GOOGLE_CONFIG : APPLE_CONFIG;
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID;

    if (!clientId) {
      return errorResponse(`${provider} OAuth not configured`, 500, origin);
    }

    // Use environment-configured callback URL for production (CloudFront), fall back to request-based detection
    // OAUTH_CALLBACK_BASE is set in production to "https://gsd.vinny.dev" for CloudFront proxy
    // For other environments, we detect from Origin header or OAUTH_REDIRECT_URI
    const callbackBase = env.OAUTH_CALLBACK_BASE || origin || env.OAUTH_REDIRECT_URI.replace('/oauth-callback', '');
    const workerCallbackUri = `${callbackBase}/api/auth/oauth/callback`;
    const appOrigin = callbackBase;

    // Generate state and PKCE verifier
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store state, verifier, and app origin in KV (short-lived)
    await env.KV.put(
      `oauth_state:${state}`,
      JSON.stringify({
        codeVerifier,
        provider,
        redirectUri: workerCallbackUri,
        appOrigin,
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
      appOrigin,
      origin,
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

    return jsonResponse({
      authUrl: authUrl.toString(),
      state,
    }, 200, origin);
  } catch (error: any) {
    logger.error('OAuth initiation failed', error, { provider });
    return errorResponse('Failed to initiate OAuth', 500, origin);
  }
}

/**
 * Handle OAuth callback
 * POST /api/auth/oauth/callback
 */
export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  try {
    // Parse request body or query params (Apple uses POST, Google uses GET redirect)
    let code: string | null = null;
    let state: string | null = null;

    const url = new URL(request.url);
    const contentType = request.headers.get('content-type');

    if (request.method === 'POST' && contentType?.includes('application/json')) {
      // JSON POST from our callback page
      const body = await request.json() as { code?: string; state?: string };
      code = body.code ?? null;
      state = body.state ?? null;
    } else if (request.method === 'POST' && contentType?.includes('application/x-www-form-urlencoded')) {
      // Apple form post
      const formData = await request.formData();
      code = formData.get('code') as string;
      state = formData.get('state') as string;
    } else {
      // Google query params (GET redirect)
      code = url.searchParams.get('code');
      state = url.searchParams.get('state');
    }

    if (!code || !state) {
      return errorResponse('Invalid callback parameters', 400, origin);
    }

    // Retrieve state from KV
    const stateKey = `oauth_state:${state}`;
    const stateDataStr = await env.KV.get(stateKey);

    if (!stateDataStr) {
      return errorResponse('Invalid or expired state', 400, origin);
    }

    const stateData = JSON.parse(stateDataStr);
    const { codeVerifier, provider, redirectUri, appOrigin } = stateData;

    // Delete used state
    await env.KV.delete(stateKey);

    const config = provider === 'google' ? GOOGLE_CONFIG : APPLE_CONFIG;
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID;

    // Exchange code for tokens (use the same redirect_uri that was used in the auth request)
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      code,
      redirect_uri: redirectUri || env.OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    // Add client_secret for both providers
    if (provider === 'google') {
      tokenParams.set('client_secret', env.GOOGLE_CLIENT_SECRET);
    } else if (provider === 'apple') {
      const clientSecret = await generateAppleClientSecret(env);
      tokenParams.set('client_secret', clientSecret);
    }

    logger.info('Token exchange request', {
      provider,
      state,
      redirect_uri: tokenParams.get('redirect_uri'),
      client_id: tokenParams.get('client_id'),
      token_endpoint: config.token_endpoint,
    });

    const tokenResponse = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Token exchange failed', new Error(errorText), {
        provider,
        state,
        redirect_uri: tokenParams.get('redirect_uri'),
        error: errorText,
      });
      return errorResponse('Token exchange failed', 500, origin);
    }

    const tokens = await tokenResponse.json() as { id_token?: string; access_token?: string };
    const idToken = tokens.id_token;

    if (!idToken) {
      return errorResponse('No ID token received', 500, origin);
    }

    // Verify ID token
    const JWKS = createRemoteJWKSet(new URL(config.jwks_uri));
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: config.issuer,
      audience: clientId,
    });

    // Extract user info
    const email = payload.email as string;
    const providerUserId = payload.sub as string;
    const emailVerified = payload.email_verified as boolean;

    if (!email || !emailVerified) {
      return errorResponse('Email not verified', 400, origin);
    }

    const now = Date.now();

    // Find or create user
    let user = await env.DB.prepare(
      'SELECT id, email, account_status, encryption_salt FROM users WHERE auth_provider = ? AND provider_user_id = ?'
    )
      .bind(provider, providerUserId)
      .first();

    const isNewUser = !user;
    const encryptionSalt = user?.encryption_salt as string | null;

    if (!user) {
      // Create new user
      const userId = generateId();
      await env.DB.prepare(
        `INSERT INTO users (id, email, auth_provider, provider_user_id, created_at, updated_at, account_status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`
      )
        .bind(userId, email, provider, providerUserId, now, now)
        .run();

      user = { id: userId, email, account_status: 'active' };
    } else {
      // Check account status
      if (user.account_status !== 'active') {
        return errorResponse('Account is suspended or deleted', 403, origin);
      }

      // Update last login
      await env.DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
        .bind(now, now, user.id)
        .run();
    }

    // Create device
    const deviceId = generateId();
    const deviceName = `${provider === 'google' ? 'Google' : 'Apple'} Device`;

    await env.DB.prepare(
      `INSERT INTO devices (id, user_id, device_name, last_seen_at, created_at, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
      .bind(deviceId, user.id, deviceName, now, now)
      .run();

    // Generate JWT token
    const { token, jti, expiresAt } = await createToken(
      user.id as string,
      user.email as string,
      deviceId,
      env.JWT_SECRET
    );

    // Store session in KV
    await env.KV.put(
      `session:${user.id}:${jti}`,
      JSON.stringify({
        deviceId,
        issuedAt: now,
        expiresAt,
        lastActivity: now,
      }),
      { expirationTtl: TTL.SESSION }
    );

    logger.info('OAuth callback successful', {
      userId: user.id as string,
      deviceId,
      provider,
      isNewUser,
    });

    const authData = {
      userId: user.id,
      deviceId,
      email: user.email,
      token,
      expiresAt,
      requiresEncryptionSetup: !encryptionSalt,
      encryptionSalt: encryptionSalt || undefined,
      provider,
    };

    // Check if this is a redirect flow (from PWA) or popup flow
    // If appOrigin is stored, this is a redirect flow - redirect back to the app
    // Otherwise, this is a popup flow - return JSON
    if (appOrigin) {
      // Build redirect URL with auth data as query params
      const redirectUrl = new URL('/oauth-callback', appOrigin);
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('userId', authData.userId as string);
      redirectUrl.searchParams.set('deviceId', authData.deviceId as string);
      redirectUrl.searchParams.set('email', authData.email as string);
      redirectUrl.searchParams.set('token', authData.token as string);
      redirectUrl.searchParams.set('expiresAt', authData.expiresAt.toString());
      redirectUrl.searchParams.set('requiresEncryptionSetup', authData.requiresEncryptionSetup.toString());
      if (authData.encryptionSalt) {
        redirectUrl.searchParams.set('encryptionSalt', authData.encryptionSalt);
      }
      redirectUrl.searchParams.set('provider', authData.provider as string);
      redirectUrl.searchParams.set('state', state);

      // Use HTTP 302 redirect to send user back to app with auth data
      // This avoids any HTML escaping issues with special characters in the token
      logger.info('OAuth redirect flow: redirecting to app', {
        appOrigin,
        redirectUrl: redirectUrl.toString(),
      });

      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl.toString(),
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      });
    }

    // Popup flow: return JSON for postMessage
    logger.info('OAuth popup flow: returning JSON', { origin });
    return jsonResponse(authData, 200, origin);
  } catch (error: any) {
    logger.error('OAuth callback failed', error, { provider: 'unknown' });

    // Try to get the state from request to determine if this is redirect or popup flow
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    let errorAppOrigin: string | null = null;

    if (state) {
      try {
        const stateDataStr = await env.KV.get(`oauth_state:${state}`);
        if (stateDataStr) {
          const stateData = JSON.parse(stateDataStr);
          errorAppOrigin = stateData.appOrigin;
        }
      } catch (e) {
        // Ignore errors when trying to retrieve state
      }
    }

    // If we have an appOrigin, redirect to app's error page
    // Otherwise use origin header as fallback for redirect
    const redirectTarget = errorAppOrigin || origin;

    if (redirectTarget) {
      // Build error redirect URL
      const redirectUrl = new URL('/oauth-callback', redirectTarget);
      redirectUrl.searchParams.set('success', 'false');
      redirectUrl.searchParams.set('error', error.message || 'OAuth callback failed');

      // Use HTTP 302 redirect
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl.toString(),
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      });
    }

    // No redirect target available: return JSON error
    return jsonResponse(
      {
        error: 'OAuth callback failed',
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      },
      500,
      origin
    );
  }
}

/**
 * Generate random string for state and code verifier
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate PKCE code challenge from verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);

  // Base64URL encode
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate Apple client secret JWT
 * Required for Apple Sign In token exchange
 */
async function generateAppleClientSecret(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // JWT header
  const header = {
    alg: 'ES256',
    kid: env.APPLE_KEY_ID,
  };

  // JWT payload
  const payload = {
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 3600, // 1 hour
    aud: 'https://appleid.apple.com',
    sub: env.APPLE_CLIENT_ID,
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign with Apple private key
  const privateKeyPem = env.APPLE_PRIVATE_KEY;
  const privateKey = await importApplePrivateKey(privateKeyPem);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(message)
  );

  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * Import Apple private key for signing
 */
async function importApplePrivateKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and decode
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );
}

/**
 * Base64URL encode
 */
function base64UrlEncode(input: string | ArrayBuffer): string {
  let str: string;

  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  }

  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
