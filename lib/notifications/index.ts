"use client";

// Re-export all notification functionality for backward compatibility

// Display functions
export {
  showTaskNotification,
  showNotification,
  showTestNotification
} from "./display";

// Permission functions
export {
  isNotificationSupported,
  checkNotificationPermission,
  requestNotificationPermission,
  shouldAskForPermission,
  isInQuietHours
} from "./permissions";

// Settings functions
export {
  getNotificationSettings,
  updateNotificationSettings
} from "./settings";

// Badge functions
export {
  isBadgeSupported,
  setAppBadge,
  clearAppBadge
} from "./badge";
