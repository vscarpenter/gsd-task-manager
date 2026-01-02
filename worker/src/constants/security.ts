/**
 * Security-related constants for the Worker
 * Centralizes security configuration values
 */

/**
 * CORS and HTTP security headers
 */
export const SECURITY_HEADERS = {
  /** CORS preflight cache duration (24 hours) */
  CORS_MAX_AGE_SECONDS: 86400,

  /** HSTS max-age directive (1 year) */
  HSTS_MAX_AGE_SECONDS: 31536000,
} as const;

/**
 * Cryptographic buffer sizes
 */
export const CRYPTO_BUFFER = {
  /** Salt buffer size in bytes (256 bits) */
  SALT_BYTES: 32,

  /** Random ID buffer size in bytes (128 bits) */
  ID_BYTES: 16,

  /** OAuth state token length in characters */
  STATE_TOKEN_LENGTH: 32,

  /** PKCE code verifier length */
  CODE_VERIFIER_LENGTH: 43,
} as const;

/**
 * JWT configuration
 */
export const JWT_CONFIG = {
  /** Apple JWT expiration in seconds (1 hour) */
  APPLE_JWT_EXP_SECONDS: 3600,
} as const;

/**
 * PBKDF2 configuration - OWASP 2023 compliant
 * Aligned across client, MCP server, and Worker for consistency
 */
export const PBKDF2_CONFIG = {
  /** PBKDF2 iterations - OWASP 2023 recommendation for SHA-256 */
  ITERATIONS: 600_000,

  /** Derived key length in bits (AES-256) */
  KEY_LENGTH_BITS: 256,

  /** Hash algorithm */
  HASH_ALGORITHM: 'SHA-256',
} as const;

/**
 * Cookie security configuration
 *
 * SECURITY TRADE-OFFS FOR TOKEN STORAGE:
 *
 * Option 1: localStorage/IndexedDB (Current Implementation)
 * - Pros: Works offline, PWA-friendly, accessible to JavaScript
 * - Cons: Vulnerable to XSS attacks if malicious script runs
 * - Mitigated by: React's built-in XSS protection, CSP headers
 *
 * Option 2: HttpOnly Cookies
 * - Pros: Not accessible to JavaScript (XSS-proof for tokens)
 * - Cons: Breaks offline-first PWA, cookies sent on every request
 * - Would require: Server-side session management
 *
 * DECISION: localStorage/IndexedDB chosen because:
 * 1. GSD is an offline-first PWA - tokens must be accessible when offline
 * 2. MCP server integration requires JavaScript access to tokens
 * 3. XSS risk is mitigated by React's escaping and CSP headers
 * 4. All sensitive data (tasks) is encrypted client-side
 *
 * If you need maximum XSS protection and don't require offline:
 * Set COOKIE_CONFIG.USE_HTTP_ONLY = true and implement server sessions
 */
export const COOKIE_CONFIG = {
  /** Use HttpOnly cookies instead of localStorage (breaks offline PWA) */
  USE_HTTP_ONLY: false,

  /** SameSite attribute for cookies */
  SAME_SITE: 'Lax' as const,

  /** Secure flag (HTTPS only) */
  SECURE: true,

  /** Cookie path */
  PATH: '/',

  /** Session cookie name */
  SESSION_COOKIE_NAME: 'gsd_session',
} as const;

/**
 * @deprecated Use PBKDF2_CONFIG instead
 * Kept for backward compatibility
 */
export const WORKER_CRYPTO = {
  /** @deprecated Use PBKDF2_CONFIG.ITERATIONS */
  PBKDF2_ITERATIONS: PBKDF2_CONFIG.ITERATIONS,

  /** @deprecated Use PBKDF2_CONFIG.KEY_LENGTH_BITS */
  KEY_LENGTH_BITS: PBKDF2_CONFIG.KEY_LENGTH_BITS,
} as const;
