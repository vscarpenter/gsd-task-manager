/**
 * Sync-related constants
 * Centralizes sync configuration values for consistency and maintenance
 */

/**
 * Sync operation configuration
 */
export const SYNC_CONFIG = {
  /** Polling interval for sync status updates in header (5 seconds) */
  SYNC_STATUS_POLL_MS: 5000,

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

  /** Default auto-sync interval in minutes for new sync configurations */
  DEFAULT_AUTO_SYNC_INTERVAL_MINUTES: 2,

  /** Default limit for sync history queries */
  DEFAULT_HISTORY_LIMIT: 50,
  /** Threshold for considering a queued operation stale (1 hour) */
  STALE_OPERATION_THRESHOLD_MS: 60 * 60 * 1000,

  /** Maximum number of consecutive sync retries before giving up */
  MAX_RETRIES: 5,

  /** Exponential backoff delays for sync retries: 5s, 10s, 30s, 60s, 300s */
  RETRY_DELAYS: [5000, 10000, 30000, 60000, 300000] as readonly number[],

  /**
   * Ceiling applied to a server-provided Retry-After before honoring it (5 min).
   * Bounds the wait so a bogus or hostile header can't freeze sync indefinitely.
   */
  MAX_RETRY_AFTER_MS: 5 * 60 * 1000,

  /**
   * Tolerated forward skew for a client-stamped `client_updated_at` (5 min).
   * `client_updated_at` is the LWW authority and comes from the writing device's
   * own unverifiable clock; a value beyond `now + this` is treated as untrustworthy
   * so a skewed/forged far-future timestamp can't permanently win LWW and lock a task.
   */
  MAX_CLIENT_CLOCK_SKEW_MS: 5 * 60 * 1000,
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
