/**
 * Worker configuration constants
 * Centralizes allowed origins, timeout values, and other configuration
 */

// Allowed origins for CORS
export const ALLOWED_ORIGINS = [
  'https://gsd.vinny.dev',      // Production
  'https://gsd-dev.vinny.dev',  // Development/Staging
  'http://localhost:3000',      // Local development
  'http://127.0.0.1:3000',      // Local development (alternative)
];

// Session and token TTL values (in seconds)
export const TTL = {
  SESSION: 60 * 60 * 24 * 7,      // 7 days - session lifetime
  OAUTH_STATE: 600,               // 10 minutes - OAuth state validity
  REVOCATION: 60 * 60 * 24 * 7,   // 7 days - keep revocation records
} as const;

// Cleanup retention periods (in days)
export const RETENTION = {
  DELETED_TASKS: 30,    // Clean up soft-deleted tasks after 30 days
  CONFLICT_LOGS: 90,    // Clean up resolved conflicts after 90 days
  INACTIVE_DEVICES: 180, // Clean up inactive devices after 6 months
} as const;

// Rate limiting configuration
export const RATE_LIMITS = {
  SYNC_OPERATIONS: {
    maxRequests: 100,    // Max requests per window
    windowMs: 60 * 1000, // 1 minute window
  },
  AUTH_OPERATIONS: {
    maxRequests: 10,     // Max auth attempts per window
    windowMs: 60 * 1000, // 1 minute window
  },
} as const;

// Storage quotas (in bytes)
export const STORAGE = {
  DEFAULT_QUOTA: 10 * 1024 * 1024,  // 10MB default quota per user
  TASK_SIZE_ESTIMATE: 1024,         // Rough estimate per task
} as const;

// OAuth provider configurations
export const GOOGLE_CONFIG = {
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  scope: 'openid email profile',
} as const;

export const APPLE_CONFIG = {
  issuer: 'https://appleid.apple.com',
  authorization_endpoint: 'https://appleid.apple.com/auth/authorize',
  token_endpoint: 'https://appleid.apple.com/auth/token',
  jwks_uri: 'https://appleid.apple.com/auth/keys',
  scope: 'openid email name',
} as const;

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;

  // Check exact match in allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow any localhost/127.0.0.1 port for development
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return true;
  }

  return false;
}

/**
 * Get the appropriate redirect URI based on origin
 */
export function getRedirectUri(origin: string | null | undefined, fallback: string): string {
  if (!origin) return fallback;

  // Use origin-specific callback for allowed origins
  if (isOriginAllowed(origin)) {
    return `${origin}/oauth-callback`;
  }

  return fallback;
}
