import { SignJWT } from 'jose';
import { generateId } from './crypto';

export interface JWTPayload {
  sub: string;      // User ID
  email: string;
  deviceId: string;
  jti: string;      // JWT ID (for revocation)
  iat: number;      // Issued at
  exp: number;      // Expires at
}

/**
 * Create a new JWT token for authenticated user
 */
export async function createToken(
  userId: string,
  email: string,
  deviceId: string,
  secret: string,
  expiresInDays = 7
): Promise<{ token: string; jti: string; expiresAt: number }> {
  const jti = generateId();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresInDays * 24 * 60 * 60;

  const secretKey = new TextEncoder().encode(secret);

  const token = await new SignJWT({
    sub: userId,
    email,
    deviceId,
    jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secretKey);

  return { token, jti, expiresAt };
}

/**
 * Refresh a token (creates new token with same claims but new expiry)
 */
export async function refreshToken(
  oldPayload: JWTPayload,
  secret: string,
  expiresInDays = 7
): Promise<{ token: string; jti: string; expiresAt: number }> {
  return createToken(
    oldPayload.sub,
    oldPayload.email,
    oldPayload.deviceId,
    secret,
    expiresInDays
  );
}
