import type { Env, RequestContext } from '../types';
import { createCorsHeaders } from './cors';
import { RATE_LIMITS } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('RATE_LIMIT');

/**
 * Hash IP address for privacy-compliant logging (GDPR)
 * Uses first 8 chars of SHA-256 hash for correlation without storing raw IPs
 */
async function hashIpForLogging(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 8); // First 8 chars for correlation
}

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
  const isMissingIp = !ctx.userId && !clientIp;

  // Log warning if falling back to 'anonymous' bucket (should never happen on Cloudflare)
  // CF-Connecting-IP is always present for legitimate requests through Cloudflare
  if (isMissingIp) {
    logger.warn('Rate limiting using anonymous bucket - missing IP headers', {
      path,
      userAgent: request.headers.get('User-Agent'),
      hasXRealIp: !!request.headers.get('X-Real-IP'),
      hasXForwardedFor: !!request.headers.get('X-Forwarded-For'),
      hasCfConnectingIp: !!request.headers.get('CF-Connecting-IP'),
    });
  }

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

  // Apply even stricter limits when falling back to 'anonymous' bucket
  // This mitigates DoS risk from requests without IP identification
  if (isMissingIp) {
    config = {
      maxRequests: Math.min(config.maxRequests, 10), // Hard cap at 10 requests
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
    // Hash IP for GDPR-compliant logging (allows correlation without storing raw IPs)
    const isAuthEndpoint = path.includes('/auth/');
    const hashedIp = isAnonymous && clientIp ? await hashIpForLogging(clientIp) : undefined;
    const logContext = {
      userId: ctx.userId,
      clientIpHash: hashedIp, // Hashed for privacy compliance
      path,
      blockedCount,
      windowSeconds: config.windowSeconds,
      isAuthEndpoint,
      isAnonymous,
      isMissingIp,
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
    // Hash IP for GDPR-compliant logging
    const warningHashedIp = isAnonymous && clientIp ? await hashIpForLogging(clientIp) : undefined;
    logger.info('Rate limit warning: approaching limit', {
      userId: ctx.userId,
      clientIpHash: warningHashedIp, // Hashed for privacy compliance
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
