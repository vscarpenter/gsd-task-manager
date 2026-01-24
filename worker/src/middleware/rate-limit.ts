import type { Env, RequestContext } from '../types';
import { createCorsHeaders } from './cors';
import { RATE_LIMITS } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('RATE_LIMIT');

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

/** Thresholds for security alerting */
const SECURITY_THRESHOLDS = {
  /** Percentage of limit that triggers a warning log */
  WARNING_PERCENT: 80,
  /** Number of consecutive blocked requests before escalating to error log */
  BLOCKED_ESCALATION: 3,
} as const;

// Rate limit configurations per endpoint
// Uses centralized config from config.ts
const rateLimits: Record<string, RateLimitConfig> = {
  '/api/auth/login': {
    maxRequests: RATE_LIMITS.AUTH_OPERATIONS.maxRequests,
    windowSeconds: RATE_LIMITS.AUTH_OPERATIONS.windowMs / 1000,
  },
  '/api/auth/register': {
    maxRequests: 5,
    windowSeconds: 60,
  },
  '/api/auth/refresh': {
    maxRequests: RATE_LIMITS.REFRESH_OPERATIONS.maxRequests,
    windowSeconds: RATE_LIMITS.REFRESH_OPERATIONS.windowMs / 1000,
  },
  '/api/sync/push': {
    maxRequests: RATE_LIMITS.SYNC_OPERATIONS.maxRequests,
    windowSeconds: RATE_LIMITS.SYNC_OPERATIONS.windowMs / 1000,
  },
  '/api/sync/pull': {
    maxRequests: RATE_LIMITS.SYNC_OPERATIONS.maxRequests,
    windowSeconds: RATE_LIMITS.SYNC_OPERATIONS.windowMs / 1000,
  },
  default: {
    maxRequests: RATE_LIMITS.SYNC_OPERATIONS.maxRequests,
    windowSeconds: RATE_LIMITS.SYNC_OPERATIONS.windowMs / 1000,
  },
};

export const rateLimitMiddleware = async (
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response | void> => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Use userId if authenticated, otherwise use client IP for rate limiting
  // This prevents all anonymous users from sharing a single rate limit bucket
  // which could be exploited for DoS or cause legitimate users to be blocked
  const clientIp = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Real-IP') ||
                   request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();

  const rateLimitKey = ctx.userId || clientIp || 'anonymous';
  const isAnonymous = !ctx.userId;

  // Get rate limit config for this endpoint
  // Apply stricter limits for anonymous/unauthenticated requests
  let config = rateLimits[path] || rateLimits.default;

  if (isAnonymous && !path.includes('/auth/')) {
    // Non-auth endpoints get stricter limits for anonymous users
    config = {
      maxRequests: Math.floor(config.maxRequests / 2),
      windowSeconds: config.windowSeconds,
    };
  }

  // Create rate limit key based on user ID or client IP
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / config.windowSeconds);
  const key = `ratelimit:${rateLimitKey}:${path}:${window}`;

  // Get current count from KV
  const currentCount = await env.KV.get(key);
  const count = currentCount ? Number.parseInt(currentCount, 10) : 0;

  // Check if rate limit exceeded
  if (count >= config.maxRequests) {
    const retryAfter = config.windowSeconds - (now % config.windowSeconds);

    // Track consecutive blocks for this user/IP/path to detect brute-force patterns
    const blockKey = `ratelimit:blocked:${rateLimitKey}:${path}`;
    const blockedCountStr = await env.KV.get(blockKey);
    const blockedCount = blockedCountStr ? Number.parseInt(blockedCountStr, 10) + 1 : 1;

    await env.KV.put(blockKey, blockedCount.toString(), {
      expirationTtl: config.windowSeconds * 5, // Track for 5 windows
    });

    // Log rate limit violation with security context
    const isAuthEndpoint = path.includes('/auth/');
    const logContext = {
      userId: ctx.userId,
      clientIp: isAnonymous ? rateLimitKey : undefined,
      path,
      blockedCount,
      windowSeconds: config.windowSeconds,
      isAuthEndpoint,
      isAnonymous,
    };

    if (blockedCount >= SECURITY_THRESHOLDS.BLOCKED_ESCALATION) {
      // Escalate to error level for potential brute-force attack
      logger.error('Potential brute-force detected: repeated rate limit violations', undefined, {
        ...logContext,
        severity: 'HIGH',
        recommendation: 'Consider IP-based blocking if pattern continues',
      });
    } else {
      logger.warn('Rate limit exceeded', logContext);
    }

    const headers = createCorsHeaders();
    headers.set('Content-Type', 'application/json');
    headers.set('Retry-After', retryAfter.toString());
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', '0');
    headers.set('X-RateLimit-Reset', (now + retryAfter).toString());

    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter,
      }),
      {
        status: 429,
        headers,
      }
    );
  }

  // Log warning when approaching rate limit (80% threshold)
  const usagePercent = (count / config.maxRequests) * 100;
  if (usagePercent >= SECURITY_THRESHOLDS.WARNING_PERCENT && count === Math.floor(config.maxRequests * 0.8)) {
    logger.info('Rate limit warning: approaching limit', {
      userId: ctx.userId,
      clientIp: isAnonymous ? rateLimitKey : undefined,
      path,
      currentCount: count,
      maxRequests: config.maxRequests,
      usagePercent: Math.round(usagePercent),
      isAnonymous,
    });
  }

  // Increment counter
  await env.KV.put(key, (count + 1).toString(), {
    expirationTtl: config.windowSeconds * 2, // Extra buffer for cleanup
  });

  // Store rate limit info in context for handlers to add to response headers
  ctx.rateLimitHeaders = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': (config.maxRequests - count - 1).toString(),
    'X-RateLimit-Reset': (now + config.windowSeconds).toString(),
  };

  return;
};
