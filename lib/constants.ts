/**
 * Application-wide constants
 *
 * Centralizes magic numbers and configuration values for consistency
 * and easier maintenance.
 */

/**
 * Base time unit conversion constants
 * Single source of truth for time conversions to avoid duplication
 */
export const TIME_UNITS = {
  /** Seconds in one minute */
  SECONDS_PER_MINUTE: 60,
  /** Minutes in one hour */
  MINUTES_PER_HOUR: 60,
  /** Minutes in one day */
  MINUTES_PER_DAY: 24 * 60, // 1440
  /** Minutes in one week */
  MINUTES_PER_WEEK: 7 * 24 * 60, // 10080
  /** Seconds in one hour */
  SECONDS_PER_HOUR: 60 * 60, // 3600
  /** Milliseconds in one second */
  MS_PER_SECOND: 1000,
  /** Milliseconds in one minute */
  MS_PER_MINUTE: 60 * 1000, // 60000
} as const;

/**
 * Time duration constants in milliseconds
 * Use these instead of inline calculations like `7 * 24 * 60 * 60 * 1000`
 */
export const TIME_MS = {
  /** One second in milliseconds */
  SECOND: TIME_UNITS.MS_PER_SECOND,
  /** One minute in milliseconds */
  MINUTE: TIME_UNITS.MS_PER_MINUTE,
  /** One hour in milliseconds */
  HOUR: TIME_UNITS.MINUTES_PER_HOUR * TIME_UNITS.MS_PER_MINUTE,
  /** One day in milliseconds */
  DAY: TIME_UNITS.MINUTES_PER_DAY * TIME_UNITS.MS_PER_MINUTE,
  /** One week in milliseconds */
  WEEK: TIME_UNITS.MINUTES_PER_WEEK * TIME_UNITS.MS_PER_MINUTE,
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
 * References TIME_UNITS for base conversions to avoid duplication
 */
export const NOTIFICATION_TIMING = {
  /** Duration to show notification before auto-closing (10 seconds) */
  AUTO_CLOSE_DURATION: 10000,
  /** Duration to show test notification (5 seconds) */
  TEST_NOTIFICATION_DURATION: 5000,
  /** Milliseconds in one minute - references TIME_UNITS */
  MS_PER_MINUTE: TIME_UNITS.MS_PER_MINUTE,
  /** Minutes in one hour - references TIME_UNITS */
  MINUTES_PER_HOUR: TIME_UNITS.MINUTES_PER_HOUR,
  /** Minutes in one day - references TIME_UNITS */
  MINUTES_PER_DAY: TIME_UNITS.MINUTES_PER_DAY,
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
 * References TIME_UNITS for base conversions to avoid duplication
 */
export const TIME_TRACKING = {
  /** Milliseconds per minute - references TIME_UNITS */
  MS_PER_MINUTE: TIME_UNITS.MS_PER_MINUTE,
  /** Minutes per hour - references TIME_UNITS */
  MINUTES_PER_HOUR: TIME_UNITS.MINUTES_PER_HOUR,
  /** Minutes per day - references TIME_UNITS */
  MINUTES_PER_DAY: TIME_UNITS.MINUTES_PER_DAY,
  /** Minutes per week - references TIME_UNITS */
  MINUTES_PER_WEEK: TIME_UNITS.MINUTES_PER_WEEK,
  /** Maximum snooze duration in minutes (1 year) - prevents unreasonably long snoozes */
  MAX_SNOOZE_MINUTES: 365 * 24 * 60,
  /** Seconds per minute - references TIME_UNITS */
  SECONDS_PER_MINUTE: TIME_UNITS.SECONDS_PER_MINUTE,
  /** Seconds per hour - references TIME_UNITS */
  SECONDS_PER_HOUR: TIME_UNITS.SECONDS_PER_HOUR,
} as const;
