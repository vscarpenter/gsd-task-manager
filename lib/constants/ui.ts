export const UI_TIMING = {
  /** Poll interval for sync status updates (500ms) */
  STATUS_POLL_INTERVAL_MS: 500,

  AUTH_CHECK_INTERVAL_MS: 2000,

  AUTO_RESET_SUCCESS_MS: 3000,

  /** Auto-reset timeout after sync error (10 seconds) — longer so users can read errors */
  AUTO_RESET_ERROR_MS: 10000,

  STATUS_REFRESH_DELAY_MS: 600,

  RELATIVE_TIME_REFRESH_MS: 30000,

  /** Delay before hiding dropdown to allow click on suggestion (200ms) */
  BLUR_DELAY_MS: 200,

  /** Delay for scrolling to a task after render (100ms) */
  SCROLL_TO_TASK_DELAY_MS: 100,

  TASK_HIGHLIGHT_DURATION_MS: 3000,

  RESET_RELOAD_DELAY_MS: 1000,

  /** Auto-refresh interval for sync debug panel (2 seconds) */
  DEBUG_PANEL_REFRESH_MS: 2000,

  /** Delay before focusing a newly-opened input field (50ms) */
  FOCUS_DELAY_MS: 50,
} as const;

export const SEARCH_CONFIG = {
  MAX_COMMAND_PALETTE_RESULTS: 10,
} as const;

