/**
 * UI timing and dimension constants
 * Centralizes UI-specific configuration values
 */

/**
 * Polling and check intervals for UI updates
 */
export const UI_TIMING = {
  /** Poll interval for sync status updates (500ms) */
  STATUS_POLL_INTERVAL_MS: 500,

  /** Interval to check for auth state changes (2 seconds) */
  AUTH_CHECK_INTERVAL_MS: 2000,

  /** Auto-reset timeout after sync success/error (3 seconds) */
  AUTO_RESET_TIMEOUT_MS: 3000,

  /** Initial delay before first health check (1 second) */
  INITIAL_HEALTH_CHECK_DELAY_MS: 1000,
} as const;

/**
 * OAuth popup window dimensions
 */
export const OAUTH_POPUP = {
  /** Popup window width in pixels */
  WIDTH: 500,

  /** Popup window height in pixels */
  HEIGHT: 600,
} as const;

/**
 * Time picker configuration
 */
export const TIME_PICKER = {
  /** Increment between time options in minutes */
  INCREMENT_MINUTES: 15,

  /** Hour value for 12-hour AM/PM conversion */
  HOURS_12: 12,

  /** Minutes in one hour */
  MINUTES_PER_HOUR: 60,
} as const;

/**
 * HTTP status codes for API responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  /** Resource no longer available (used for expired OAuth results) */
  GONE: 410,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;
