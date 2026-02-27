/**
 * Sync-related constants (Supabase backend)
 * Centralizes sync configuration values for consistency and maintenance
 */

/**
 * Sync operation configuration
 */
export const SYNC_CONFIG = {
  /** Polling interval for pending operation count (2 seconds) */
  PENDING_COUNT_POLL_INTERVAL_MS: 2000,

  /** Retry countdown update interval (1 second) */
  COUNTDOWN_UPDATE_INTERVAL_MS: 1000,

  /** Cooldown between health issue notifications (5 minutes) */
  NOTIFICATION_COOLDOWN_MS: 5 * 60 * 1000,

  /** Health check interval (5 minutes) */
  HEALTH_CHECK_INTERVAL_MS: 5 * 60 * 1000,

  /** Initial health check delay (10 seconds) */
  INITIAL_HEALTH_CHECK_DELAY_MS: 10000,

  /** Initial sync delay after starting background sync (10 seconds) */
  INITIAL_SYNC_DELAY_MS: 10000,

  /** Default limit for sync history queries */
  DEFAULT_HISTORY_LIMIT: 50,
} as const;

/**
 * Encryption configuration
 */
export const ENCRYPTION_CONFIG = {
  /** PBKDF2 iterations for key derivation (OWASP 2023 recommendation) */
  PBKDF2_ITERATIONS: 600_000,

  /** AES-GCM key length in bits */
  KEY_LENGTH: 256,

  /** AES-GCM nonce length in bytes (96 bits) */
  NONCE_LENGTH: 12,

  /** AES-GCM tag length in bits */
  TAG_LENGTH: 128,

  /** Minimum passphrase length for encryption */
  PASSPHRASE_MIN_LENGTH: 12,

  /** Delay after encryption setup before triggering auto-sync (1 second) */
  AUTO_SYNC_DELAY_MS: 1000,
} as const;

/**
 * Toast notification durations for sync operations
 */
export const SYNC_TOAST_DURATION = {
  /** Short success messages (3 seconds) */
  SHORT: 3000,

  /** Medium warnings (5 seconds) */
  MEDIUM: 5000,

  /** Long errors or important messages (7 seconds) */
  LONG: 7000,
} as const;
