import type { Env, RegisterRequest, LoginRequest, RequestContext } from '../types';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { registerRequestSchema, loginRequestSchema } from '../schemas';
import { hashPassword, verifyPassword, generateSalt, generateId } from '../utils/crypto';
import { createToken } from '../utils/jwt';
import { TTL } from '../config';

// ============================================================================
// Helper Types
// ============================================================================

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  account_status: string;
}

interface SessionData {
  deviceId: string;
  issuedAt: number;
  expiresAt: number;
  lastActivity: number;
}

// ============================================================================
// Database Helpers - Registration
// ============================================================================

/** Check if email already exists in database */
async function checkEmailExists(env: Env, email: string): Promise<boolean> {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  return !!existing;
}

/** Create new user in database */
async function createUser(
  env: Env, userId: string, email: string, passwordHash: string, salt: string, now: number
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, salt, created_at, updated_at, account_status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  ).bind(userId, email, passwordHash, salt, now, now).run();
}

/** Create new device in database */
async function createDevice(
  env: Env, deviceId: string, userId: string, deviceName: string, now: number
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO devices (id, user_id, device_name, last_seen_at, created_at, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).bind(deviceId, userId, deviceName, now, now).run();
}

/** Store session in KV with TTL */
async function storeSession(
  env: Env, userId: string, jti: string, session: SessionData
): Promise<void> {
  await env.KV.put(
    `session:${userId}:${jti}`,
    JSON.stringify(session),
    { expirationTtl: TTL.SESSION }
  );
}

// ============================================================================
// Registration Handler
// ============================================================================

/**
 * Register a new user account
 * POST /api/auth/register
 */
export async function register(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const validated = registerRequestSchema.parse(body) as RegisterRequest;

    if (await checkEmailExists(env, validated.email)) {
      return errorResponse('Email already registered', 409);
    }

    const userId = generateId();
    const salt = generateSalt();
    const now = Date.now();
    const passwordHash = await hashPassword(validated.password, salt);

    await createUser(env, userId, validated.email, passwordHash, salt, now);

    const deviceId = generateId();
    await createDevice(env, deviceId, userId, validated.deviceName, now);

    const { token, jti, expiresAt } = await createToken(userId, validated.email, deviceId, env.JWT_SECRET);
    await storeSession(env, userId, jti, { deviceId, issuedAt: now, expiresAt, lastActivity: now });

    return jsonResponse({ userId, deviceId, salt, token, expiresAt }, 201);
  } catch (error: unknown) {
    return handleRegistrationError(error, env);
  }
}

/** Handle registration errors with appropriate responses */
function handleRegistrationError(error: unknown, env: Env): Response {
  console.error('Register error:', error);
  const err = error as { name?: string; message?: string; stack?: string };

  if (err.name === 'ZodError') {
    return errorResponse('Invalid request data: ' + err.message, 400);
  }

  return jsonResponse({
    error: 'Registration failed',
    message: env.ENVIRONMENT === 'development' ? err.message : 'An error occurred during registration',
    ...(env.ENVIRONMENT === 'development' && { stack: err.stack?.split('\n').slice(0, 3).join('\n') })
  }, 500);
}

// ============================================================================
// Database Helpers - Login
// ============================================================================

// Dummy values for timing attack prevention
const TIMING_ATTACK_DUMMY_SALT = 'Q5J6K8L9M0N1P2R3S4T5U6W7X8Y9Z0A1B2C3D4E5F6G7H8';
const TIMING_ATTACK_DUMMY_HASH = 'VGhpcyBpcyBhIGR1bW15IGhhc2ggZm9yIHRpbWluZyBhdHRhY2sgcHJldmVudGlvbg==';

/** Find user by email */
async function findUserByEmail(env: Env, email: string): Promise<UserRecord | null> {
  const result = await env.DB.prepare(
    'SELECT id, email, password_hash, salt, account_status FROM users WHERE email = ?'
  ).bind(email).first();
  return result as UserRecord | null;
}

/** Verify credentials with timing attack protection */
async function verifyCredentials(
  passwordHash: string, user: UserRecord | null
): Promise<boolean> {
  const actualSalt = user ? user.salt : TIMING_ATTACK_DUMMY_SALT;
  const actualHash = user ? user.password_hash : TIMING_ATTACK_DUMMY_HASH;
  return verifyPassword(passwordHash, actualSalt, actualHash);
}

/** Check if device exists and is active */
async function checkDeviceExists(env: Env, deviceId: string, userId: string): Promise<boolean> {
  const device = await env.DB.prepare(
    'SELECT id FROM devices WHERE id = ? AND user_id = ? AND is_active = 1'
  ).bind(deviceId, userId).first();
  return !!device;
}

/** Update device last seen timestamp */
async function updateDeviceLastSeen(env: Env, deviceId: string, now: number): Promise<void> {
  await env.DB.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?')
    .bind(now, deviceId).run();
}

/** Update user last login timestamp */
async function updateUserLastLogin(env: Env, userId: string, now: number): Promise<void> {
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(now, userId).run();
}

/** Handle device management during login - returns deviceId and syncRequired flag */
async function handleDeviceForLogin(
  env: Env, userId: string, providedDeviceId: string | undefined, deviceName: string, now: number
): Promise<{ deviceId: string; syncRequired: boolean }> {
  if (providedDeviceId && await checkDeviceExists(env, providedDeviceId, userId)) {
    await updateDeviceLastSeen(env, providedDeviceId, now);
    return { deviceId: providedDeviceId, syncRequired: false };
  }

  // Create new device if none provided or existing was revoked
  const newDeviceId = generateId();
  await createDevice(env, newDeviceId, userId, deviceName || 'Unknown Device', now);
  return { deviceId: newDeviceId, syncRequired: true };
}

// ============================================================================
// Login Handler
// ============================================================================

/**
 * Login to existing account
 * POST /api/auth/login
 */
export async function login(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const validated = loginRequestSchema.parse(body) as LoginRequest;

    const user = await findUserByEmail(env, validated.email);
    const isValid = await verifyCredentials(validated.passwordHash, user);

    if (!user || !isValid) {
      return errorResponse('Invalid credentials', 401);
    }
    if (user.account_status !== 'active') {
      return errorResponse('Account is suspended or deleted', 403);
    }

    const now = Date.now();
    const { deviceId, syncRequired } = await handleDeviceForLogin(
      env, user.id, validated.deviceId, validated.deviceName || '', now
    );

    await updateUserLastLogin(env, user.id, now);

    const { token, jti, expiresAt } = await createToken(user.id, user.email, deviceId, env.JWT_SECRET);
    await storeSession(env, user.id, jti, { deviceId, issuedAt: now, expiresAt, lastActivity: now });

    return jsonResponse({ userId: user.id, deviceId, salt: user.salt, token, expiresAt, syncRequired });
  } catch (error: unknown) {
    return handleLoginError(error);
  }
}

/** Handle login errors with appropriate responses */
function handleLoginError(error: unknown): Response {
  console.error('Login error:', error);
  const err = error as { name?: string };
  if (err.name === 'ZodError') {
    return errorResponse('Invalid request data', 400);
  }
  return errorResponse('Login failed', 500);
}

/**
 * Refresh JWT token
 * POST /api/auth/refresh
 */
export async function refresh(_request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  try {
    if (!ctx.userId || !ctx.deviceId || !ctx.email) {
      return errorResponse('Invalid token', 401);
    }

    // Generate new token
    const { token, jti, expiresAt } = await createToken(
      ctx.userId,
      ctx.email,
      ctx.deviceId,
      env.JWT_SECRET
    );

    // Store new session in KV
    await env.KV.put(
      `session:${ctx.userId}:${jti}`,
      JSON.stringify({
        deviceId: ctx.deviceId,
        issuedAt: Date.now(),
        expiresAt,
        lastActivity: Date.now(),
      }),
      { expirationTtl: TTL.SESSION }
    );

    return jsonResponse({
      token,
      expiresAt,
    });

  } catch (error) {
    console.error('Refresh error:', error);
    return errorResponse('Token refresh failed', 500);
  }
}

/**
 * Logout and revoke token
 * POST /api/auth/logout
 */
export async function logout(_request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  try {
    if (!ctx.userId) {
      return errorResponse('Not authenticated', 401);
    }

    // Get all sessions for user and revoke them
    const sessions = await env.KV.list({ prefix: `session:${ctx.userId}:` });

    for (const key of sessions.keys) {
      const jti = key.name.split(':')[2];
      await env.KV.put(`revoked:${ctx.userId}:${jti}`, 'true', {
        expirationTtl: TTL.SESSION, // Keep revocation record for session duration
      });
      await env.KV.delete(key.name);
    }

    return jsonResponse({ success: true });

  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Logout failed', 500);
  }
}
