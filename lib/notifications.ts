"use client";

import { getDb } from "@/lib/db";
import type { TaskRecord, NotificationSettings } from "@/lib/types";
import { notificationSettingsSchema } from "@/lib/schema";
import { NOTIFICATION_TIMING, NOTIFICATION_ASSETS, TIME_UTILS } from "@/lib/constants";

async function getActiveServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !navigator.serviceWorker) {
    return undefined;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.error("Error resolving service worker registration:", error);
    return undefined;
  }
}

/**
 * Check if the browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Check current notification permission status
 */
export function checkNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    // Update settings to mark that we've asked
    const settings = await getNotificationSettings();
    await updateNotificationSettings({ ...settings, permissionAsked: true });
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

/**
 * Determine if we should ask for notification permission
 * Only ask if we haven't asked before and permission is not yet determined
 */
export async function shouldAskForPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false;
  }

  const permission = checkNotificationPermission();
  if (permission !== "default") {
    return false; // Already granted or denied
  }

  const settings = await getNotificationSettings();
  return !settings.permissionAsked;
}

/**
 * Get notification settings from database
 * Creates default settings if none exist
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const db = getDb();

  let settings = await db.notificationSettings.get("settings");

  if (!settings) {
    // Create default settings
    const defaultSettings: NotificationSettings = {
      id: "settings",
      enabled: true,
      defaultReminder: NOTIFICATION_TIMING.DEFAULT_REMINDER_MINUTES,
      soundEnabled: true,
      permissionAsked: false,
      updatedAt: new Date().toISOString()
    };

    await db.notificationSettings.put(defaultSettings);
    settings = defaultSettings;
  }

  // Validate settings with schema
  return notificationSettingsSchema.parse(settings);
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  updates: Partial<NotificationSettings>
): Promise<void> {
  const db = getDb();
  const current = await getNotificationSettings();

  const updated: NotificationSettings = {
    ...current,
    ...updates,
    id: "settings", // Ensure ID is always "settings"
    updatedAt: new Date().toISOString()
  };

  // Validate before saving
  const validated = notificationSettingsSchema.parse(updated);
  await db.notificationSettings.put(validated);
}

/**
 * Show a notification for a task that is due soon
 */
export async function showTaskNotification(
  task: TaskRecord,
  minutesUntil: number
): Promise<void> {
  if (!isNotificationSupported()) {
    return;
  }

  const permission = checkNotificationPermission();
  if (permission !== "granted") {
    return;
  }

  const settings = await getNotificationSettings();
  if (!settings.enabled || !task.notificationEnabled) {
    return;
  }

  // Check if snoozed
  if (isTaskSnoozed(task)) {
    return;
  }

  try {
    const title = getNotificationTitle(task, minutesUntil);
    const options = createNotificationOptions(task, settings);
    const registration = await getActiveServiceWorker();

    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return;
    }

    if (typeof Notification === "undefined") {
      return;
    }

    displayFallbackNotification(title, options);
  } catch (error) {
    console.error("Error showing notification:", error);
  }
}

/**
 * Check if the task is currently snoozed
 */
function isTaskSnoozed(task: TaskRecord): boolean {
  if (!task.snoozedUntil) return false;
  return new Date(task.snoozedUntil) > new Date();
}

/**
 * Create notification options object
 */
function createNotificationOptions(
  task: TaskRecord,
  settings: NotificationSettings
): NotificationOptions {
  return {
    body: task.description || "Task reminder",
    icon: NOTIFICATION_ASSETS.ICON_192,
    badge: NOTIFICATION_ASSETS.BADGE,
    tag: `task-${task.id}`,
    requireInteraction: false,
    silent: !settings.soundEnabled,
    data: {
      taskId: task.id,
      dueDate: task.dueDate
    }
  };
}

/**
 * Display notification using fallback Notification API
 */
function displayFallbackNotification(title: string, options: NotificationOptions): void {
  const notification = new Notification(title, options);

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  setTimeout(() => {
    notification.close();
  }, NOTIFICATION_TIMING.AUTO_CLOSE_DURATION);
}

/**
 * Generate notification title based on time until due
 */
function getNotificationTitle(task: TaskRecord, minutesUntil: number): string {
  if (minutesUntil <= 0) {
    return `Due now: ${task.title}`;
  } else if (minutesUntil < NOTIFICATION_TIMING.MINUTES_PER_HOUR) {
    return `Due in ${Math.round(minutesUntil)} min: ${task.title}`;
  } else if (minutesUntil < NOTIFICATION_TIMING.MINUTES_PER_DAY) {
    const hours = Math.round(minutesUntil / NOTIFICATION_TIMING.MINUTES_PER_HOUR);
    return `Due in ${hours}h: ${task.title}`;
  } else {
    const days = Math.round(minutesUntil / NOTIFICATION_TIMING.MINUTES_PER_DAY);
    return `Due in ${days}d: ${task.title}`;
  }
}

/**
 * Check if current time is within quiet hours
 */
export function isInQuietHours(settings: NotificationSettings): boolean {
  if (!settings.quietHoursStart || !settings.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentTime = TIME_UTILS.timeToMinutes(now.getHours(), now.getMinutes());

  const [startHour, startMin] = settings.quietHoursStart.split(":").map(Number);
  const [endHour, endMin] = settings.quietHoursEnd.split(":").map(Number);

  const quietStart = TIME_UTILS.timeToMinutes(startHour, startMin);
  const quietEnd = TIME_UTILS.timeToMinutes(endHour, endMin);

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (quietStart > quietEnd) {
    return currentTime >= quietStart || currentTime < quietEnd;
  }

  // Normal quiet hours (e.g., 13:00 to 14:00)
  return currentTime >= quietStart && currentTime < quietEnd;
}

/**
 * Test notification - shows a sample notification
 */
export async function showTestNotification(): Promise<boolean> {
  const permission = checkNotificationPermission();

  if (permission !== "granted") {
    const granted = await requestNotificationPermission();
    if (!granted) {
      return false;
    }
  }

  try {
    const notification = new Notification("Test Notification", {
      body: "Your notifications are working correctly!",
      icon: NOTIFICATION_ASSETS.ICON_192,
      badge: NOTIFICATION_ASSETS.BADGE,
      tag: "test-notification",
      requireInteraction: false
    });

    setTimeout(() => {
      notification.close();
    }, NOTIFICATION_TIMING.TEST_NOTIFICATION_DURATION);

    return true;
  } catch (error) {
    console.error("Error showing test notification:", error);
    return false;
  }
}

/**
 * Check if the Badge API is supported
 * Supported on: Chrome/Edge (desktop/mobile), Safari/iOS 16.4+
 */
export function isBadgeSupported(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

/**
 * Set the app badge to a specific count
 * Shows a badge on the PWA icon with the given number
 */
export async function setAppBadge(count: number): Promise<void> {
  if (!isBadgeSupported()) {
    return;
  }

  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
  } catch (error) {
    console.error("Error setting app badge:", error);
  }
}

/**
 * Clear the app badge
 */
export async function clearAppBadge(): Promise<void> {
  if (!isBadgeSupported()) {
    return;
  }

  try {
    await navigator.clearAppBadge();
  } catch (error) {
    console.error("Error clearing app badge:", error);
  }
}
