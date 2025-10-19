/**
 * OAuth Security Configuration
 *
 * Centralizes allowed origins and security constants for OAuth flows.
 * Following OAuth 2.0 security best practices with defense-in-depth approach.
 */

// Allowed origins for OAuth callback postMessages
// These are the only origins we trust to send authentication data
export const ALLOWED_OAUTH_ORIGINS = [
  // Production
  'https://gsd.vinny.dev',

  // Development/Staging
  'https://gsd-dev.vinny.dev',

  // Worker domains (production)
  'https://gsd-sync-worker.vscarpenter.workers.dev',

  // Worker domains (development/staging)
  'https://gsd-sync-worker-dev.vscarpenter.workers.dev',
  'https://gsd-sync-worker-staging.vscarpenter.workers.dev',

  // Local development
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8787',  // Local worker
  'http://127.0.0.1:8787',  // Local worker
] as const;

// State token configuration
export const OAUTH_STATE_CONFIG = {
  // Maximum age for OAuth state tokens (10 minutes)
  MAX_STATE_AGE_MS: 10 * 60 * 1000,

  // Minimum length for state tokens
  MIN_STATE_LENGTH: 32,

  // Interval for cleaning up expired states (1 minute)
  CLEANUP_INTERVAL_MS: 60 * 1000,
} as const;

/**
 * Check if an origin is allowed to send OAuth callbacks
 */
export function isOAuthOriginAllowed(origin: string): boolean {
  // Reject null, undefined, or empty strings
  if (!origin) {
    return false;
  }

  // Check exact match in allowed list
  if ((ALLOWED_OAUTH_ORIGINS as readonly string[]).includes(origin)) {
    return true;
  }

  // Allow any localhost/127.0.0.1 port for development flexibility
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return true;
  }

  return false;
}

/**
 * Get current environment for logging
 */
export function getOAuthEnvironment(): 'production' | 'development' | 'staging' | 'local' {
  if (typeof window === 'undefined') return 'local';

  const { hostname } = window.location;

  if (hostname === 'gsd.vinny.dev') return 'production';
  if (hostname === 'gsd-dev.vinny.dev') return 'staging';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';

  return 'development';
}
