import { Router, type IRequest } from 'itty-router';
import type { Env, RequestContext } from './types';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { createCorsHeaders, jsonResponse, errorResponse } from './middleware/cors';
import { TTL } from './config';
import { createLogger } from './utils/logger';
import * as oidcHandlers from './handlers/oidc';
import * as syncHandlers from './handlers/sync';

const logger = createLogger('WORKER');

// Create router
const router = Router();

// CORS preflight
router.options('*', (request: Request) => {
  const origin = request.headers.get('Origin');
  return new Response(null, { headers: createCorsHeaders(origin) });
});

// Health check
router.get('/health', (request: Request) => {
  const origin = request.headers.get('Origin');
  return jsonResponse({ status: 'ok', timestamp: Date.now() }, 200, origin);
});

// OAuth endpoints (rate limited, no auth required)
router.get('/api/auth/oauth/:provider/start', async (request: IRequest, env: Env, executionCtx: ExecutionContext) => {
  const origin = request.headers.get('Origin');
  const ctx: RequestContext = { executionCtx };
  const rateLimitResult = await rateLimitMiddleware(request as unknown as Request, env, ctx);
  if (rateLimitResult) return rateLimitResult;

  const provider = request.params?.provider as 'google' | 'apple';
  if (provider !== 'google' && provider !== 'apple') {
    return errorResponse('Invalid provider', 400, origin);
  }
  return oidcHandlers.initiateOAuth(request as unknown as Request, env, provider);
});

router.post('/api/auth/oauth/callback', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;

  return oidcHandlers.handleOAuthCallback(request, env);
});

router.get('/api/auth/oauth/callback', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;

  return oidcHandlers.handleOAuthCallback(request, env);
});

router.get('/api/auth/oauth/result', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;

  return oidcHandlers.getOAuthResult(request, env);
});

// Get encryption salt
router.get('/api/auth/encryption-salt', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const origin = request.headers.get('Origin');
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;

  try {
    const user = await env.DB.prepare('SELECT encryption_salt FROM users WHERE id = ?')
      .bind(ctx.userId)
      .first();

    if (!user) {
      return errorResponse('User not found', 404, origin);
    }

    return jsonResponse({
      encryptionSalt: user.encryption_salt as string | null,
    }, 200, origin);
  } catch (error) {
    logger.error('Get encryption salt failed', error as Error, { userId: ctx.userId });
    return errorResponse('Failed to get encryption salt', 500, origin);
  }
});

// Save encryption salt
router.post('/api/auth/encryption-salt', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const origin = request.headers.get('Origin');
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;

  try {
    const body = await request.json() as { encryptionSalt?: string };
    const { encryptionSalt } = body;

    if (!encryptionSalt || typeof encryptionSalt !== 'string') {
      return errorResponse('Invalid encryption salt', 400, origin);
    }

    // Save encryption salt to user record
    await env.DB.prepare('UPDATE users SET encryption_salt = ? WHERE id = ?')
      .bind(encryptionSalt, ctx.userId)
      .run();

    logger.info('Encryption salt saved', { userId: ctx.userId });

    return jsonResponse({ success: true }, 200, origin);
  } catch (error) {
    logger.error('Save encryption salt failed', error as Error, { userId: ctx.userId });
    return errorResponse('Failed to save encryption salt', 500, origin);
  }
});

// Protected endpoints (auth required)
router.post('/api/auth/logout', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const origin = request.headers.get('Origin');
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;

  // Logout logic: revoke session
  if (!ctx.userId) {
    return errorResponse('Not authenticated', 401, origin);
  }

  try {
    // Get all sessions for user and revoke them
    const sessions = await env.KV.list({ prefix: `session:${ctx.userId}:` });

    for (const key of sessions.keys) {
      const jti = key.name.split(':')[2];
      await env.KV.put(`revoked:${ctx.userId}:${jti}`, 'true', {
        expirationTtl: TTL.REVOCATION,
      });
      await env.KV.delete(key.name);
    }

    logger.info('User logged out', { userId: ctx.userId });

    return jsonResponse({ success: true }, 200, origin);
  } catch (error) {
    logger.error('Logout failed', error as Error, { userId: ctx.userId });
    return errorResponse('Logout failed', 500, origin);
  }
});

router.post('/api/auth/refresh', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const origin = request.headers.get('Origin');
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;

  // Add rate limiting to prevent abuse
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;

  // Refresh logic: issue new JWT
  if (!ctx.userId || !ctx.deviceId || !ctx.email) {
    return errorResponse('Invalid token', 401, origin);
  }

  try {
    const { createToken } = await import('./utils/jwt');
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

    logger.info('Token refreshed', { userId: ctx.userId, deviceId: ctx.deviceId });

    return jsonResponse({
      token,
      expiresAt,
    }, 200, origin);
  } catch (error) {
    logger.error('Token refresh failed', error as Error, { userId: ctx.userId });
    return errorResponse('Token refresh failed', 500, origin);
  }
});

// Sync endpoints (auth + rate limiting)
router.post('/api/sync/push', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;
  return syncHandlers.push(request, env, ctx);
});

router.post('/api/sync/pull', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;
  return syncHandlers.pull(request, env, ctx);
});

router.post('/api/sync/resolve', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.resolve(request, env, ctx);
});

router.get('/api/sync/status', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.status(request, env, ctx);
});

router.get('/api/stats', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.stats(request, env, ctx);
});

// Device management endpoints
router.get('/api/devices', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.listDevices(request, env, ctx);
});

router.delete('/api/devices/:id', async (request: Request, env: Env, executionCtx: ExecutionContext) => {
  const ctx: RequestContext = { executionCtx };
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.revokeDevice(request, env, ctx);
});

// 404 handler
router.all('*', () => errorResponse('Not Found', 404));

// Main fetch handler
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle the request with router
      const response = await router.fetch(request, env, ctx);
      return response;
    } catch (error: unknown) {
      logger.error('Worker error', error as Error);
      return jsonResponse(
        {
          error: 'Internal Server Error',
          ...(env.ENVIRONMENT === 'development' && {
            message: (error as Error).message,
            stack: (error as Error).stack
          })
        },
        500
      );
    }
  },

  // Cron trigger for cleanup tasks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const { runCleanup } = await import('./handlers/cleanup');

    try {
      const result = await runCleanup(env);

      logger.info('Scheduled cleanup completed', {
        deletedTasks: result.deletedTasks,
        conflictLogs: result.conflictLogs,
        inactiveDevices: result.inactiveDevices,
        totalDuration: `${result.duration}ms`,
      });
    } catch (error) {
      logger.error('Scheduled cleanup failed', error as Error);
    }
  },
};

export default worker;
