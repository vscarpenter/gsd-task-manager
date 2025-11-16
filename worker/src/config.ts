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
  OAUTH_STATE: 1800,              // 30 minutes - OAuth state validity (increased for iPad PWA context switching)
  REVOCATION: 60 * 60 * 24 * 7,   // 7 days - keep revocation records
} as const;

export const OAUTH_COOKIE = {
  name: 'gsd_oauth_session',
  maxAge: TTL.OAUTH_STATE,
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
  REFRESH_OPERATIONS: {
    maxRequests: 20,               // Max refresh attempts per window
    windowMs: 60 * 60 * 1000,      // 1 hour window
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

// Allowed development ports for localhost
const ALLOWED_DEV_PORTS = ['3000', '3001', '5173', '8080'];

/**
 * Check if an origin is allowed
 * @param origin - The origin to check
 * @param environment - Optional environment string ('development', 'staging', 'production')
 */
export function isOriginAllowed(
  origin: string | null | undefined,
  environment?: string
): boolean {
  if (!origin) return false;

  // Check exact match in allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Only allow specific localhost ports in development environment
  // In staging/production, only the specific localhost:3000 from ALLOWED_ORIGINS is allowed
  if (environment === 'development') {
    if (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      try {
        const url = new URL(origin);
        const port = url.port || '80';
        return ALLOWED_DEV_PORTS.includes(port);
      } catch {
        return false;
      }
    }
  }

  return false;
}

/**
 * Get the appropriate redirect URI based on origin
 */
export function getRedirectUri(
  origin: string | null | undefined,
  fallback: string,
  environment?: string
): string {
  if (!origin) return fallback;

  // Use origin-specific callback for allowed origins
  if (isOriginAllowed(origin, environment)) {
    return `${origin}/oauth-callback.html`;
  }

  return fallback;
}
