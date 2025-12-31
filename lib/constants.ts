/**
 * Application-wide constants
 *
 * Centralizes magic numbers and configuration values for consistency
 * and easier maintenance.
 */

/**
 * Time duration constants in milliseconds
 * Use these instead of inline calculations like `7 * 24 * 60 * 60 * 1000`
 */
export const TIME_MS = {
  /** One second in milliseconds */
  SECOND: 1000,
  /** One minute in milliseconds */
  MINUTE: 60 * 1000,
  /** One hour in milliseconds */
  HOUR: 60 * 60 * 1000,
  /** One day in milliseconds */
  DAY: 24 * 60 * 60 * 1000,
  /** One week in milliseconds */
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

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
  BACKGROUND_SYNC_INTERVAL_MINUTES: 15,
  /** Default reminder time before task due date (15 minutes) */
  DEFAULT_REMINDER_MINUTES: 15
} as const;

/**
 * PWA and notification asset paths
 */
export const NOTIFICATION_ASSETS = {
  /** Path to 192x192 icon for notifications and PWA */
  ICON_192: '/icon-192.png',
  /** Path to badge icon for notifications */
  BADGE: '/icon-192.png'
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

/**
 * Time tracking constants
 */
export const TIME_TRACKING = {
  /** Milliseconds per minute (for time calculations) */
  MS_PER_MINUTE: 60000,
  /** Minutes per hour */
  MINUTES_PER_HOUR: 60,
  /** Minutes per day */
  MINUTES_PER_DAY: 24 * 60,
  /** Minutes per week */
  MINUTES_PER_WEEK: 7 * 24 * 60,
  /** Maximum snooze duration in minutes (1 year) - prevents unreasonably long snoozes */
  MAX_SNOOZE_MINUTES: 365 * 24 * 60,
  /** Seconds per minute */
  SECONDS_PER_MINUTE: 60,
  /** Seconds per hour */
  SECONDS_PER_HOUR: 3600,
} as const;
