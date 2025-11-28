import type { Env } from '../../types';
import { JWT_CONFIG } from '../../constants/security';
import { ALLOWED_ORIGINS } from '../../config';

/**
 * Determine the app origin from request context
 * Used when OAuth state is not available (expired/invalid)
 * Returns the most likely app origin based on request headers and environment
 */
export function getAppOriginFromRequest(request: Request, env: Env): string | null {
  // Priority 1: Use OAUTH_CALLBACK_BASE if set (explicit configuration)
  if (env.OAUTH_CALLBACK_BASE) {
    return env.OAUTH_CALLBACK_BASE;
  }

  // Priority 2: Check Referer header (might contain app origin)
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = refererUrl.origin;
      if (ALLOWED_ORIGINS.includes(refererOrigin)) {
        return refererOrigin;
      }
    } catch {
      // Invalid referer URL, continue to next option
    }
  }

  // Priority 3: Check Origin header
  const origin = request.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // Priority 4: Derive from environment
  if (env.ENVIRONMENT === 'production') {
    return 'https://gsd.vinny.dev';
  }
  if (env.ENVIRONMENT === 'staging' || env.ENVIRONMENT === 'development') {
    return 'https://gsd-dev.vinny.dev';
  }

  // Priority 5: Default to production
  return 'https://gsd.vinny.dev';
}

/**
 * Generate random string for state and code verifier
 */
export function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate PKCE code challenge from verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
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
 * Base64URL encode
 */
export function base64UrlEncode(input: string | ArrayBuffer): string {
  let str: string;

  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  }

  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import Apple private key for signing
 */
export async function importApplePrivateKey(pem: string): Promise<CryptoKey> {
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
 * Generate Apple client secret JWT
 * Required for Apple Sign In token exchange
 */
export async function generateAppleClientSecret(env: Env): Promise<string> {
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
    exp: now + JWT_CONFIG.APPLE_JWT_EXP_SECONDS,
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
