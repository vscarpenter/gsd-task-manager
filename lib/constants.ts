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
