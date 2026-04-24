/**
 * JWT-based auth token inspection for get_token_status.
 *
 * PocketBase issues standard JWTs; the `exp` claim lets us report accurate
 * expiration, days remaining, and graduated warnings without hitting the
 * server. Decoding is base64 only — no signature check — because the server
 * enforces validity on every request.
 */

export type TokenHealth = 'healthy' | 'warning' | 'critical' | 'expired' | 'invalid';

export interface TokenStatusResult {
  status: TokenHealth;
  expired: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  message: string;
  instructions: string[] | null;
}

/** Warning thresholds (days remaining) for graduated reauth prompts. */
const WARNING_DAYS = 14;
const CRITICAL_DAYS = 3;

/**
 * Decode a JWT payload without verifying the signature.
 * Returns null on any parse failure — callers treat that as `invalid`.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    // PocketBase uses base64url; pad to make it standard base64.
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function reauthInstructions(): string[] {
  return [
    '1. Visit https://gsd.vinny.dev and sign in',
    '2. Open Settings → Sync and copy your auth token',
    '3. Update GSD_AUTH_TOKEN in your Claude Desktop config',
    '4. Restart Claude Desktop',
  ];
}

/**
 * Inspect a PocketBase JWT and return a structured health report.
 */
export function getTokenStatus(token: string | null | undefined, now: Date = new Date()): TokenStatusResult {
  if (!token) {
    return {
      status: 'invalid',
      expired: true,
      expiresAt: null,
      daysRemaining: null,
      message: 'No auth token is configured.',
      instructions: reauthInstructions(),
    };
  }

  const payload = decodeJwtPayload(token);
  const exp = payload && typeof payload.exp === 'number' ? payload.exp : null;

  if (!payload || exp === null) {
    return {
      status: 'invalid',
      expired: true,
      expiresAt: null,
      daysRemaining: null,
      message:
        'Auth token is not a valid PocketBase JWT. Please re-authenticate to generate a new token.',
      instructions: reauthInstructions(),
    };
  }

  const expiresAt = new Date(exp * 1000);
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

  if (msRemaining <= 0) {
    return {
      status: 'expired',
      expired: true,
      expiresAt: expiresAt.toISOString(),
      daysRemaining: 0,
      message: `Auth token expired on ${expiresAt.toISOString()}. Please re-authenticate.`,
      instructions: reauthInstructions(),
    };
  }

  if (daysRemaining <= CRITICAL_DAYS) {
    return {
      status: 'critical',
      expired: false,
      expiresAt: expiresAt.toISOString(),
      daysRemaining,
      message: `Auth token expires in ${daysRemaining} day(s). Re-authenticate soon to avoid interruption.`,
      instructions: reauthInstructions(),
    };
  }

  if (daysRemaining <= WARNING_DAYS) {
    return {
      status: 'warning',
      expired: false,
      expiresAt: expiresAt.toISOString(),
      daysRemaining,
      message: `Auth token expires in ${daysRemaining} days. Consider re-authenticating this week.`,
      instructions: reauthInstructions(),
    };
  }

  return {
    status: 'healthy',
    expired: false,
    expiresAt: expiresAt.toISOString(),
    daysRemaining,
    message: `Auth token is healthy. Expires in ${daysRemaining} days.`,
    instructions: null,
  };
}
