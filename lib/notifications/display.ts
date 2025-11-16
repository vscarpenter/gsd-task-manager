"use client";

import type { TaskRecord, NotificationSettings } from "@/lib/types";
import { NOTIFICATION_TIMING, NOTIFICATION_ASSETS } from "@/lib/constants";
import { getNotificationSettings } from "./settings";
import {
  isNotificationSupported,
  checkNotificationPermission,
  requestNotificationPermission
} from "./permissions";

/**
 * Get active service worker registration
 */
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
 * Check if the task is currently snoozed
 */
function isTaskSnoozed(task: TaskRecord): boolean {
  if (!task.snoozedUntil) return false;
  return new Date(task.snoozedUntil) > new Date();
}

/**
 * Generate notification title based on time until due
 */
function getNotificationTitle(task: TaskRecord, minutesUntil: number): string {
  if (minutesUntil <= 0) {
    return `Due now: ${task.title}`;
  }

  if (minutesUntil < NOTIFICATION_TIMING.MINUTES_PER_HOUR) {
    return `Due in ${Math.round(minutesUntil)} min: ${task.title}`;
  }

  if (minutesUntil < NOTIFICATION_TIMING.MINUTES_PER_DAY) {
    const hours = Math.round(minutesUntil / NOTIFICATION_TIMING.MINUTES_PER_HOUR);
    return `Due in ${hours}h: ${task.title}`;
  }

  const days = Math.round(minutesUntil / NOTIFICATION_TIMING.MINUTES_PER_DAY);
  return `Due in ${days}d: ${task.title}`;
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
 * Check if notification should be shown for task
 */
function shouldShowTaskNotification(
  task: TaskRecord,
  settings: NotificationSettings
): boolean {
  if (!settings.enabled || !task.notificationEnabled) {
    return false;
  }
  return !isTaskSnoozed(task);
}

/**
 * Display notification using service worker or fallback
 */
async function displayNotification(
  title: string,
  options: NotificationOptions
): Promise<void> {
  const registration = await getActiveServiceWorker();

  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return;
  }

  if (typeof Notification === "undefined") {
    return;
  }

  displayFallbackNotification(title, options);
}

/**
 * Show a notification for a task that is due soon
 */
export async function showTaskNotification(
  task: TaskRecord,
  minutesUntil: number
): Promise<void> {
  if (!isNotificationSupported() || checkNotificationPermission() !== "granted") {
    return;
  }

  const settings = await getNotificationSettings();
  if (!shouldShowTaskNotification(task, settings)) {
    return;
  }

  try {
    const title = getNotificationTitle(task, minutesUntil);
    const options = createNotificationOptions(task, settings);
    await displayNotification(title, options);
  } catch (error) {
    console.error("Error showing notification:", error);
  }
}

/**
 * Create default notification options
 */
function createDefaultOptions(
  body: string,
  customOptions?: Partial<NotificationOptions>
): NotificationOptions {
  return {
    body,
    icon: NOTIFICATION_ASSETS.ICON_192,
    badge: NOTIFICATION_ASSETS.BADGE,
    requireInteraction: false,
    ...customOptions
  };
}

/**
 * Show a generic notification with custom title and body
 */
export async function showNotification(
  title: string,
  body: string,
  options?: Partial<NotificationOptions>
): Promise<void> {
  if (!isNotificationSupported() || checkNotificationPermission() !== "granted") {
    return;
  }

  try {
    const notificationOptions = createDefaultOptions(body, options);
    await displayNotification(title, notificationOptions);
  } catch (error) {
    console.error("Error showing notification:", error);
  }
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
