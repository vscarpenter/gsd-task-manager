import { jwtVerify } from 'jose';
import type { Env, RequestContext } from '../types';
import { errorResponse } from './cors';

export interface AuthMiddleware {
  (request: Request, env: Env, ctx: RequestContext): Promise<Response | void>;
}

export const authMiddleware: AuthMiddleware = async (request, env, ctx) => {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT signature and expiration
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // Extract user info from JWT payload
    ctx.userId = payload.sub as string;
    ctx.deviceId = payload.deviceId as string;
    ctx.email = payload.email as string;

    // Verify token hasn't been revoked (check KV)
    const revokedKey = `revoked:${ctx.userId}:${payload.jti}`;
    const isRevoked = await env.KV.get(revokedKey);

    if (isRevoked) {
      return errorResponse('Token has been revoked', 401);
    }

    // Update last activity timestamp in KV
    const sessionKey = `session:${ctx.userId}:${payload.jti}`;
    const session = await env.KV.get(sessionKey, 'json');

    if (session) {
      await env.KV.put(
        sessionKey,
        JSON.stringify({ ...session, lastActivity: Date.now() }),
        { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
      );
    }

    // Continue to next handler
    return;

  } catch (error) {
    console.error('Auth error:', error);
    return errorResponse('Invalid or expired token', 401);
  }
};

// Helper to extract user ID from request context
export function requireAuth(ctx: RequestContext): string {
  if (!ctx.userId) {
    throw new Error('User not authenticated');
  }
  return ctx.userId;
}
