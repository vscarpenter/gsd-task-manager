import type { Env, RegisterRequest, LoginRequest, RequestContext } from '../types';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { registerRequestSchema, loginRequestSchema } from '../schemas';
import { hashPassword, verifyPassword, generateSalt, generateId } from '../utils/crypto';
import { createToken } from '../utils/jwt';

/**
 * Register a new user account
 * POST /api/auth/register
 */
export async function register(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const validated = registerRequestSchema.parse(body) as RegisterRequest;

    // Check if email already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    )
      .bind(validated.email)
      .first();

    if (existingUser) {
      return errorResponse('Email already registered', 409);
    }

    // Generate user ID and salt
    const userId = generateId();
    const salt = generateSalt();
    const now = Date.now();

    // Hash password with salt
    const passwordHash = await hashPassword(validated.password, salt);

    // Create user in database
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, salt, created_at, updated_at, account_status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    )
      .bind(userId, validated.email, passwordHash, salt, now, now)
      .run();

    // Create initial device
    const deviceId = generateId();
    await env.DB.prepare(
      `INSERT INTO devices (id, user_id, device_name, last_seen_at, created_at, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
      .bind(deviceId, userId, validated.deviceName, now, now)
      .run();

    // Generate JWT token
    const { token, jti, expiresAt } = await createToken(
      userId,
      validated.email,
      deviceId,
      env.JWT_SECRET
    );

    // Store session in KV
    await env.KV.put(
      `session:${userId}:${jti}`,
      JSON.stringify({
        deviceId,
        issuedAt: now,
        expiresAt,
        lastActivity: now,
      }),
      { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
    );

    return jsonResponse({
      userId,
      deviceId,
      salt,
      token,
      expiresAt,
    }, 201);

  } catch (error: any) {
    console.error('Register error:', error);
    if (error.name === 'ZodError') {
      return errorResponse('Invalid request data: ' + error.message, 400);
    }
    return jsonResponse({
      error: 'Registration failed',
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    }, 500);
  }
}

/**
 * Login to existing account
 * POST /api/auth/login
 */
export async function login(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const validated = loginRequestSchema.parse(body) as LoginRequest;

    // Find user by email
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, salt, account_status FROM users WHERE email = ?'
    )
      .bind(validated.email)
      .first();

    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    // Check account status
    if (user.account_status !== 'active') {
      return errorResponse('Account is suspended or deleted', 403);
    }

    // Verify password
    const isValid = await verifyPassword(
      validated.passwordHash,
      user.salt as string,
      user.password_hash as string
    );

    if (!isValid) {
      return errorResponse('Invalid credentials', 401);
    }

    const now = Date.now();
    let deviceId = validated.deviceId;
    let syncRequired = false;

    // Check if device exists
    if (deviceId) {
      const existingDevice = await env.DB.prepare(
        'SELECT id FROM devices WHERE id = ? AND user_id = ? AND is_active = 1'
      )
        .bind(deviceId, user.id)
        .first();

      if (!existingDevice) {
        // Device was revoked or doesn't exist, create new one
        deviceId = generateId();
        await env.DB.prepare(
          `INSERT INTO devices (id, user_id, device_name, last_seen_at, created_at, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`
        )
          .bind(deviceId, user.id, validated.deviceName || 'Unknown Device', now, now)
          .run();
        syncRequired = true;
      } else {
        // Update last seen
        await env.DB.prepare(
          'UPDATE devices SET last_seen_at = ? WHERE id = ?'
        )
          .bind(now, deviceId)
          .run();
      }
    } else {
      // Create new device
      deviceId = generateId();
      await env.DB.prepare(
        `INSERT INTO devices (id, user_id, device_name, last_seen_at, created_at, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
        .bind(deviceId, user.id, validated.deviceName || 'Unknown Device', now, now)
        .run();
      syncRequired = true;
    }

    // Update last login
    await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(now, user.id)
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
      salt: user.salt,
      token,
      expiresAt,
      syncRequired,
    });

  } catch (error: any) {
    console.error('Login error:', error);
    if (error.name === 'ZodError') {
      return errorResponse('Invalid request data', 400);
    }
    return errorResponse('Login failed', 500);
  }
}

/**
 * Refresh JWT token
 * POST /api/auth/refresh
 */
export async function refresh(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
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
      { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
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
export async function logout(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  try {
    if (!ctx.userId) {
      return errorResponse('Not authenticated', 401);
    }

    // Get all sessions for user and revoke them
    const sessions = await env.KV.list({ prefix: `session:${ctx.userId}:` });

    for (const key of sessions.keys) {
      const jti = key.name.split(':')[2];
      await env.KV.put(`revoked:${ctx.userId}:${jti}`, 'true', {
        expirationTtl: 60 * 60 * 24 * 7, // Keep revocation record for 7 days
      });
      await env.KV.delete(key.name);
    }

    return jsonResponse({ success: true });

  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Logout failed', 500);
  }
}
