/**
 * JWT utilities for parsing device ID and token metadata
 */

import { z } from 'zod';

/**
 * JWT payload schema (matches Worker's jwt.ts structure)
 */
const jwtPayloadSchema = z.object({
  sub: z.string(),      // User ID (subject)
  email: z.string(),
  deviceId: z.string(), // Device ID (camelCase)
  jti: z.string(),      // JWT ID
  iat: z.number(),      // Issued at
  exp: z.number(),      // Expiration
});

export type JWTPayload = z.infer<typeof jwtPayloadSchema>;

/**
 * Parse JWT token and extract payload
 * Does NOT validate signature (server validates on API calls)
 */
export function parseJWT(token: string): JWTPayload {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode base64url payload
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded);

    return jwtPayloadSchema.parse(parsed);
  } catch (error) {
    throw new Error(
      `Failed to parse JWT: ${error instanceof Error ? error.message : 'Invalid token format'}`
    );
  }
}

/**
 * Extract device ID from JWT token
 */
export function getDeviceIdFromToken(token: string): string {
  const payload = parseJWT(token);
  return payload.deviceId;
}

/**
 * Extract user ID from JWT token
 */
export function getUserIdFromToken(token: string): string {
  const payload = parseJWT(token);
  return payload.sub;
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = parseJWT(token);
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch {
    return true; // Treat invalid tokens as expired
  }
}

/**
 * Get days until token expires
 * Returns negative number if already expired
 */
export function getDaysUntilExpiration(token: string): number {
  try {
    const payload = parseJWT(token);
    const now = Math.floor(Date.now() / 1000);
    const secondsRemaining = payload.exp - now;
    return Math.floor(secondsRemaining / (60 * 60 * 24));
  } catch {
    return -1;
  }
}

/**
 * Get token expiration as Date object
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const payload = parseJWT(token);
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}
