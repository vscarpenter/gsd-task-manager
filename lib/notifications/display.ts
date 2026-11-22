"use client";

import type { TaskRecord, NotificationSettings } from "@/lib/types";
import { NOTIFICATION_TIMING, NOTIFICATION_ASSETS } from "@/lib/constants";
import { differenceInCalendarDays } from "date-fns";
import { timeOf } from "@/lib/due-time";
import { getNotificationSettings } from "./settings";
import {
  isNotificationSupported,
  checkNotificationPermission,
  requestNotificationPermission
} from "./permissions";
import { createLogger } from "@/lib/logger";
import { isResetPending } from "@/lib/reset-lock";

const logger = createLogger("NOTIFICATIONS");

async function getActiveServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !navigator.serviceWorker) {
    return undefined;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // ready never rejects if registration fails. Release the shared reset lock
    // and use the existing fallback when no worker activates within two seconds.
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<undefined>((resolve) => { timeout = setTimeout(() => resolve(undefined), 2_000); }),
    ]);
  } catch (error) {
    logger.error("Error resolving service worker registration", error instanceof Error ? error : new Error(String(error)));
    return undefined;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function isTaskSnoozed(task: TaskRecord): boolean {
  if (!task.snoozedUntil) return false;
  return new Date(task.snoozedUntil) > new Date();
}

function getNotificationTitle(task: TaskRecord, minutesUntil: number): string {
  // An all-day task counts calendar days: hours to its midnight is a time nobody chose.
  if (task.dueDate !== undefined && timeOf(task.dueDate) === undefined) {
    const days = differenceInCalendarDays(new Date(task.dueDate), new Date());
    if (days <= 0) return `Due today: ${task.title}`;
    if (days === 1) return `Due tomorrow: ${task.title}`;
    return `Due in ${days} days: ${task.title}`;
  }

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

function createNotificationOptions(
  task: TaskRecord,
  settings: NotificationSettings
): NotificationOptions & { renotify: boolean } {
  return {
    body: task.description || "Task reminder",
    icon: NOTIFICATION_ASSETS.ICON_192,
    badge: NOTIFICATION_ASSETS.BADGE,
    tag: `task-${task.id}`,
    // A snoozed reminder shares this tag, and would otherwise replace one still on screen silently.
    renotify: true,
    requireInteraction: false,
    silent: !settings.soundEnabled,
    data: {
      taskId: task.id,
      dueDate: task.dueDate
    }
  };
}

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

function shouldShowTaskNotification(
  task: TaskRecord,
  settings: NotificationSettings
): boolean {
  // A task saved before the flag existed has none; the schema default is on.
  if (!settings.enabled || task.notificationEnabled === false) {
    return false;
  }
  return !isTaskSnoozed(task);
}

/**
 * Display notification using service worker or fallback.
 * Returns false when neither is available.
 */
async function displayNotification(
  title: string,
  options: NotificationOptions
): Promise<boolean> {
  const registration = await getActiveServiceWorker();
  if (isResetPending()) return false;

  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }

  if (typeof Notification === "undefined") {
    return false;
  }

  displayFallbackNotification(title, options);
  return true;
}

/**
 * Show a notification for a task that is due soon.
 * Returns true only when the notification was shown, so a skipped or failed
 * reminder is never marked sent.
 */
export async function showTaskNotification(
  task: TaskRecord,
  minutesUntil: number
): Promise<boolean> {
  if (!isNotificationSupported() || checkNotificationPermission() !== "granted") {
    return false;
  }

  const settings = await getNotificationSettings();
  if (!shouldShowTaskNotification(task, settings)) {
    return false;
  }

  try {
    const title = getNotificationTitle(task, minutesUntil);
    const options = createNotificationOptions(task, settings);
    return await displayNotification(title, options);
  } catch (error) {
    logger.error("Error showing notification", error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * The weekly sweep reminder. Fixed text: no count, no task title, no task content, because
 * it fires whether or not any card exists (spec: tasks/spec-weekly-sweep.md section 6).
 */
export async function showSweepReminder(): Promise<boolean> {
  if (!isNotificationSupported() || checkNotificationPermission() !== "granted") return false;
  try {
    const settings = await getNotificationSettings();
    return await displayNotification("Weekly sweep", {
      body: "A few minutes to clear what's gone quiet.",
      icon: NOTIFICATION_ASSETS.ICON_192,
      badge: NOTIFICATION_ASSETS.BADGE,
      tag: "weekly-sweep",
      silent: !settings.soundEnabled,
    });
  } catch (error) {
    logger.error("Error showing the weekly sweep reminder", error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

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
    logger.error("Error showing test notification", error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}
