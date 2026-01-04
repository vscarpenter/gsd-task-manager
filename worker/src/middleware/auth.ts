import { jwtVerify } from 'jose';
import type { Env, RequestContext } from '../types';
import { errorResponse } from './cors';
import { createLogger } from '../utils/logger';

const logger = createLogger('AUTH');

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

    // Verify token hasn't been revoked (check KV) - must await for security
    const revokedKey = `revoked:${ctx.userId}:${payload.jti}`;
    const isRevoked = await env.KV.get(revokedKey);

    if (isRevoked) {
      return errorResponse('Token has been revoked', 401);
    }

    // Update last activity timestamp in KV (non-blocking via waitUntil)
    // This is for activity tracking - uses waitUntil to guarantee completion
    const sessionKey = `session:${ctx.userId}:${payload.jti}`;
    const updateSession = async () => {
      try {
        const session = await env.KV.get(sessionKey, 'json');
        if (session) {
          await env.KV.put(
            sessionKey,
            JSON.stringify({ ...session, lastActivity: Date.now() }),
            { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
          );
        }
      } catch (error) {
        // Log but don't fail the request - session tracking is non-critical
        logger.warn('Session activity update failed', {
          userId: ctx.userId,
          error: (error as Error).message,
        });
      }
    };

    // Use waitUntil if available (Cloudflare Workers), otherwise fire-and-forget
    if (ctx.executionCtx?.waitUntil) {
      ctx.executionCtx.waitUntil(updateSession());
    } else {
      // Fallback for environments without ExecutionContext
      updateSession().catch(() => {});
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
