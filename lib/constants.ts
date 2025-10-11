/**
 * Application-wide constants
 *
 * Centralizes magic numbers and configuration values for consistency
 * and easier maintenance.
 */

/**
 * Drag-and-drop configuration
 */
export const DND_CONFIG = {
  /** Minimum pixel distance to trigger pointer drag (prevents accidental drags) */
  POINTER_DISTANCE: 8,
  /** Delay in milliseconds before touch drag activates */
  TOUCH_DELAY: 250,
  /** Pixel tolerance for touch drag activation */
  TOUCH_TOLERANCE: 5
} as const;

/**
 * Toast notification durations in milliseconds
 */
export const TOAST_DURATION = {
  /** Short duration for simple confirmations (3 seconds) */
  SHORT: 3000,
  /** Long duration for actions with undo (5 seconds) */
  LONG: 5000
} as const;

/**
 * Browser notification timing constants
 */
export const NOTIFICATION_TIMING = {
  /** Duration to show notification before auto-closing (10 seconds) */
  AUTO_CLOSE_DURATION: 10000,
  /** Duration to show test notification (5 seconds) */
  TEST_NOTIFICATION_DURATION: 5000,
  /** Milliseconds in one minute */
  MS_PER_MINUTE: 60000,
  /** Minutes in one hour */
  MINUTES_PER_HOUR: 60,
  /** Minutes in one day */
  MINUTES_PER_DAY: 1440,
  /** How many minutes past due we still send notifications (1 hour) */
  OVERDUE_NOTIFICATION_THRESHOLD: -60,
  /** Default check interval when app is open (1 minute) */
  DEFAULT_CHECK_INTERVAL_MINUTES: 1,
  /** Background sync interval for PWA when closed (15 minutes) */
  BACKGROUND_SYNC_INTERVAL_MINUTES: 15
} as const;

/**
 * Time conversion utilities
 */
export const TIME_UTILS = {
  /** Convert hours to minutes */
  hoursToMinutes: (hours: number) => hours * NOTIFICATION_TIMING.MINUTES_PER_HOUR,
  /** Convert days to minutes */
  daysToMinutes: (days: number) => days * NOTIFICATION_TIMING.MINUTES_PER_DAY,
  /** Convert milliseconds to minutes */
  msToMinutes: (ms: number) => ms / NOTIFICATION_TIMING.MS_PER_MINUTE,
  /** Convert time HH:MM to minutes since midnight */
  timeToMinutes: (hour: number, min: number) =>
    hour * NOTIFICATION_TIMING.MINUTES_PER_HOUR + min
} as const;
