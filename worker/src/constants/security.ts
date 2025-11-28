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
 * Worker PBKDF2 iterations
 * Note: Lower than client-side due to Worker CPU limits
 * Client uses 600,000 iterations for stronger key derivation
 */
export const WORKER_CRYPTO = {
  /** PBKDF2 iterations for Worker environment */
  PBKDF2_ITERATIONS: 100_000,

  /** Derived key length in bits */
  KEY_LENGTH_BITS: 256,
} as const;
