import { Router } from 'itty-router';
import type { Env, RequestContext } from './types';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { corsHeaders, jsonResponse } from './middleware/cors';
import * as oidcHandlers from './handlers/oidc';
import * as syncHandlers from './handlers/sync';

// Create router
const router = Router();

// CORS preflight
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/health', () => jsonResponse({ status: 'ok', timestamp: Date.now() }));

// OAuth endpoints (no auth required)
router.get('/api/auth/oauth/:provider/start', async (request: Request, env: Env) => {
  const provider = request.params?.provider as 'google' | 'apple';
  if (provider !== 'google' && provider !== 'apple') {
    return new Response('Invalid provider', { status: 400, headers: corsHeaders });
  }
  return oidcHandlers.initiateOAuth(request, env, provider);
});

router.post('/api/auth/oauth/callback', async (request: Request, env: Env) => {
  return oidcHandlers.handleOAuthCallback(request, env);
});

router.get('/api/auth/oauth/callback', async (request: Request, env: Env) => {
  return oidcHandlers.handleOAuthCallback(request, env);
});

// Protected endpoints (auth required)
router.post('/api/auth/logout', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;

  // Logout logic: revoke session
  if (!ctx.userId) {
    return new Response('Not authenticated', { status: 401, headers: corsHeaders });
  }

  try {
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
    return new Response('Logout failed', { status: 500, headers: corsHeaders });
  }
});

router.post('/api/auth/refresh', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;

  // Refresh logic: issue new JWT
  if (!ctx.userId || !ctx.deviceId || !ctx.email) {
    return new Response('Invalid token', { status: 401, headers: corsHeaders });
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
      { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
    );

    return jsonResponse({
      token,
      expiresAt,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return new Response('Token refresh failed', { status: 500, headers: corsHeaders });
  }
});

// Sync endpoints (auth + rate limiting)
router.post('/api/sync/push', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;
  return syncHandlers.push(request, env, ctx);
});

router.post('/api/sync/pull', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  const rateLimitResult = await rateLimitMiddleware(request, env, ctx);
  if (rateLimitResult) return rateLimitResult;
  return syncHandlers.pull(request, env, ctx);
});

router.post('/api/sync/resolve', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.resolve(request, env, ctx);
});

router.get('/api/sync/status', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.status(request, env, ctx);
});

// Device management endpoints
router.get('/api/devices', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.listDevices(request, env, ctx);
});

router.delete('/api/devices/:id', async (request: Request, env: Env) => {
  const ctx: RequestContext = {};
  const authResult = await authMiddleware(request, env, ctx);
  if (authResult) return authResult;
  return syncHandlers.revokeDevice(request, env, ctx);
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

// Main fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle the request with router
      const response = await router.fetch(request, env, ctx);
      return response;
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: env.ENVIRONMENT === 'development' ? error.message : undefined,
          stack: env.ENVIRONMENT === 'development' ? error.stack : undefined,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },

  // Cron trigger for cleanup tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running scheduled cleanup tasks...');

    try {
      // Clean up old deleted tasks (30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      await env.DB.prepare('DELETE FROM encrypted_tasks WHERE deleted_at < ?')
        .bind(thirtyDaysAgo)
        .run();

      // Clean up old conflict logs (90 days)
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      await env.DB.prepare('DELETE FROM conflict_log WHERE resolved_at < ?')
        .bind(ninetyDaysAgo)
        .run();

      // Clean up inactive devices (6 months)
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      await env.DB.prepare('DELETE FROM devices WHERE last_seen_at < ? AND is_active = 0')
        .bind(sixMonthsAgo)
        .run();

      console.log('Cleanup tasks completed');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  },
};
