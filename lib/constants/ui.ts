/**
 * UI timing and dimension constants
 * Centralizes UI-specific configuration values
 */

import { TIME_UNITS } from "@/lib/constants";

/**
 * Polling and check intervals for UI updates
 */
export const UI_TIMING = {
  /** Poll interval for sync status updates (500ms) */
  STATUS_POLL_INTERVAL_MS: 500,

  /** Interval to check for auth state changes (2 seconds) */
  AUTH_CHECK_INTERVAL_MS: 2000,

  /** Auto-reset timeout after sync success (3 seconds) */
  AUTO_RESET_SUCCESS_MS: 3000,

  /** Auto-reset timeout after sync error (10 seconds) — longer so users can read errors */
  AUTO_RESET_ERROR_MS: 10000,

  /** Initial delay before first health check (1 second) */
  INITIAL_HEALTH_CHECK_DELAY_MS: 1000,

  /** Delay before refreshing sync status display (600ms) */
  STATUS_REFRESH_DELAY_MS: 600,

  /** Interval to force re-render for relative time display updates (30 seconds) */
  RELATIVE_TIME_REFRESH_MS: 30000,

  /** Delay before hiding dropdown to allow click on suggestion (200ms) */
  BLUR_DELAY_MS: 200,

  /** Delay for scrolling to a task after render (100ms) */
  SCROLL_TO_TASK_DELAY_MS: 100,

  /** Duration to show task highlight animation (3 seconds) */
  TASK_HIGHLIGHT_DURATION_MS: 3000,

  /** Delay before page reload after reset (1 second) */
  RESET_RELOAD_DELAY_MS: 1000,

  /** Auto-dismiss duration for returning users launch screen (1.5 seconds) */
  LAUNCH_AUTO_DISMISS_MS: 1500,

  /** Fade-out animation duration for launch screen (600ms) */
  LAUNCH_FADE_OUT_MS: 600,

  /** Auto-refresh interval for sync debug panel (2 seconds) */
  DEBUG_PANEL_REFRESH_MS: 2000,
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
 * References TIME_UNITS for base conversions to avoid duplication
 */
export const TIME_PICKER = {
  /** Increment between time options in minutes */
  INCREMENT_MINUTES: 15,

  /** Hour value for 12-hour AM/PM conversion */
  HOURS_12: 12,

  /** Minutes in one hour - references TIME_UNITS */
  MINUTES_PER_HOUR: TIME_UNITS.MINUTES_PER_HOUR,
} as const;

/**
 * Search and filtering configuration
 */
export const SEARCH_CONFIG = {
  /** Maximum search results to display in command palette */
  MAX_COMMAND_PALETTE_RESULTS: 10,
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
