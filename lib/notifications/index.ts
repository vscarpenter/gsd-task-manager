"use client";

// Re-export all notification functionality for backward compatibility

export {
  showTaskNotification,
  showSweepReminder,
  showTestNotification
} from "./display";

export {
  isNotificationSupported,
  checkNotificationPermission,
  requestNotificationPermission,
  shouldAskForPermission,
  isInQuietHours
} from "./permissions";

export {
  getNotificationSettings,
  updateNotificationSettings,
  toggleNotificationSound,
  toggleQuietHours,
  setQuietHoursEdge
} from "./settings";

export {
  isBadgeSupported,
  setAppBadge,
  clearAppBadge
} from "./badge";
