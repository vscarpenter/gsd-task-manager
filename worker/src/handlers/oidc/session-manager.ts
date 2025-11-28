import type { Env } from '../../types';
import { generateId } from '../../utils/crypto';
import { createToken } from '../../utils/jwt';
import { TTL } from '../../config';

export interface SessionData {
  deviceId: string;
  token: string;
  expiresAt: number;
}

/**
 * Create a new device entry for the authenticated user
 */
export async function createDevice(
  userId: string,
  provider: string,
  env: Env
): Promise<string> {
  const deviceId = generateId();
  const deviceName = `${provider === 'google' ? 'Google' : 'Apple'} Device`;
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO devices (id, user_id, device_name, last_seen_at, created_at, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  )
    .bind(deviceId, userId, deviceName, now, now)
    .run();

  return deviceId;
}

/**
 * Generate JWT token and store session in KV
 */
export async function createSession(
  userId: string,
  email: string,
  deviceId: string,
  env: Env
): Promise<SessionData> {
  const { token, jti, expiresAt } = await createToken(userId, email, deviceId, env.JWT_SECRET);
  const now = Date.now();

  await env.KV.put(
    `session:${userId}:${jti}`,
    JSON.stringify({
      deviceId,
      issuedAt: now,
      expiresAt,
      lastActivity: now,
    }),
    { expirationTtl: TTL.SESSION }
  );

  return { deviceId, token, expiresAt };
}

export interface AuthData {
  userId: string;
  deviceId: string;
  email: string;
  token: string;
  expiresAt: number;
  requiresEncryptionSetup: boolean;
  encryptionSalt?: string;
  provider: string;
}

/**
 * Build the authentication data response object
 */
export function buildAuthData(
  userId: string,
  email: string,
  session: SessionData,
  encryptionSalt: string | null,
  provider: string
): AuthData {
  return {
    userId,
    deviceId: session.deviceId,
    email,
    token: session.token,
    expiresAt: session.expiresAt,
    requiresEncryptionSetup: !encryptionSalt,
    encryptionSalt: encryptionSalt || undefined,
    provider,
  };
}

/**
 * Store OAuth result in KV for later retrieval by the app
 */
export async function storeOAuthResult(
  state: string,
  authData: AuthData,
  appOrigin: string | null,
  sessionId: string,
  env: Env
): Promise<void> {
  await env.KV.put(
    `oauth_result:${state}`,
    JSON.stringify({
      status: 'success',
      authData,
      appOrigin,
      sessionId,
      createdAt: Date.now(),
    }),
    { expirationTtl: TTL.OAUTH_STATE }
  );
}
