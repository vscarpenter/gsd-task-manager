import type { Env, RequestContext } from '../types';
import { errorResponse } from './cors';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

// Rate limit configurations per endpoint
const rateLimits: Record<string, RateLimitConfig> = {
  '/api/auth/login': { maxRequests: 10, windowSeconds: 60 },
  '/api/auth/register': { maxRequests: 5, windowSeconds: 60 },
  '/api/sync/push': { maxRequests: 60, windowSeconds: 60 },
  '/api/sync/pull': { maxRequests: 60, windowSeconds: 60 },
  default: { maxRequests: 100, windowSeconds: 60 },
};

export const rateLimitMiddleware = async (
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response | void> => {
  const url = new URL(request.url);
  const path = url.pathname;
  const userId = ctx.userId || 'anonymous';

  // Get rate limit config for this endpoint
  const config = rateLimits[path] || rateLimits.default;

  // Create rate limit key
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / config.windowSeconds);
  const key = `ratelimit:${userId}:${path}:${window}`;

  // Get current count from KV
  const currentCount = await env.KV.get(key);
  const count = currentCount ? parseInt(currentCount, 10) : 0;

  // Check if rate limit exceeded
  if (count >= config.maxRequests) {
    const retryAfter = config.windowSeconds - (now % config.windowSeconds);

    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (now + retryAfter).toString(),
        },
      }
    );
  }

  // Increment counter
  await env.KV.put(key, (count + 1).toString(), {
    expirationTtl: config.windowSeconds * 2, // Extra buffer for cleanup
  });

  // Add rate limit headers to response
  request.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  request.headers.set('X-RateLimit-Remaining', (config.maxRequests - count - 1).toString());
  request.headers.set('X-RateLimit-Reset', (now + config.windowSeconds).toString());

  return;
};
