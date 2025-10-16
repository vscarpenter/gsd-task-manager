import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Env } from '../types';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { generateId } from '../utils/crypto';
import { createToken } from '../utils/jwt';

// Google OIDC configuration
export const GOOGLE_CONFIG = {
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
};

// Apple OIDC configuration
export const APPLE_CONFIG = {
  issuer: 'https://appleid.apple.com',
  authorization_endpoint: 'https://appleid.apple.com/auth/authorize',
  token_endpoint: 'https://appleid.apple.com/auth/token',
  jwks_uri: 'https://appleid.apple.com/auth/keys',
};

/**
 * Initiate OAuth flow
 * GET /api/auth/oauth/:provider/start
 */
export async function initiateOAuth(
  request: Request,
  env: Env,
  provider: 'google' | 'apple'
): Promise<Response> {
  try {
    const config = provider === 'google' ? GOOGLE_CONFIG : APPLE_CONFIG;
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID;

    if (!clientId) {
      return errorResponse(`${provider} OAuth not configured`, 500);
    }

    // Generate state and PKCE verifier
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store state and verifier in KV (short-lived)
    await env.KV.put(
      `oauth_state:${state}`,
      JSON.stringify({
        codeVerifier,
        provider,
        createdAt: Date.now(),
      }),
      { expirationTtl: 600 } // 10 minutes
    );

    // Build authorization URL
    const authUrl = new URL(config.authorization_endpoint);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', env.OAUTH_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    if (provider === 'apple') {
      authUrl.searchParams.set('response_mode', 'form_post');
    }

    return jsonResponse({
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error: any) {
    console.error('OAuth initiation error:', error);
    return errorResponse('Failed to initiate OAuth', 500);
  }
}

/**
 * Handle OAuth callback
 * POST /api/auth/oauth/callback
 */
export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body or query params (Apple uses POST, Google uses GET redirect)
    let code: string | null = null;
    let state: string | null = null;

    const url = new URL(request.url);
    const contentType = request.headers.get('content-type');

    if (request.method === 'POST' && contentType?.includes('application/x-www-form-urlencoded')) {
      // Apple form post
      const formData = await request.formData();
      code = formData.get('code') as string;
      state = formData.get('state') as string;
    } else {
      // Google query params
      code = url.searchParams.get('code');
      state = url.searchParams.get('state');
    }

    if (!code || !state) {
      return errorResponse('Invalid callback parameters', 400);
    }

    // Retrieve state from KV
    const stateKey = `oauth_state:${state}`;
    const stateDataStr = await env.KV.get(stateKey);

    if (!stateDataStr) {
      return errorResponse('Invalid or expired state', 400);
    }

    const stateData = JSON.parse(stateDataStr);
    const { codeVerifier, provider } = stateData;

    // Delete used state
    await env.KV.delete(stateKey);

    const config = provider === 'google' ? GOOGLE_CONFIG : APPLE_CONFIG;
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID;

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      code,
      redirect_uri: env.OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    // Apple requires client_secret
    if (provider === 'apple') {
      const clientSecret = await generateAppleClientSecret(env);
      tokenParams.set('client_secret', clientSecret);
    }

    const tokenResponse = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return errorResponse('Token exchange failed', 500);
    }

    const tokens = await tokenResponse.json();
    const idToken = tokens.id_token;

    if (!idToken) {
      return errorResponse('No ID token received', 500);
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
      return errorResponse('Email not verified', 400);
    }

    const now = Date.now();

    // Find or create user
    let user = await env.DB.prepare(
      'SELECT id, email, account_status FROM users WHERE auth_provider = ? AND provider_user_id = ?'
    )
      .bind(provider, providerUserId)
      .first();

    const isNewUser = !user;

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
        return errorResponse('Account is suspended or deleted', 403);
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
      { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
    );

    return jsonResponse({
      userId: user.id,
      deviceId,
      email: user.email,
      token,
      expiresAt,
      requiresEncryptionSetup: isNewUser, // Flag to show encryption passphrase dialog
      provider,
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return jsonResponse(
      {
        error: 'OAuth callback failed',
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      },
      500
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
