"use client";

import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";
import {
  getNotificationSettings,
  isInQuietHours,
  showTaskNotification,
  checkNotificationPermission,
  setAppBadge,
  isNotificationSupported
} from "@/lib/notifications";
import { isoNow } from "@/lib/utils";
import { NOTIFICATION_TIMING, TIME_UTILS } from "@/lib/constants";

/**
 * NotificationChecker class
 * Periodically checks for tasks that are due and sends notifications
 */
class NotificationChecker {
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheck: Date | null = null;
  private isChecking = false;

  /**
   * Check all tasks and send notifications for those that are due
   */
  async checkAndNotify(): Promise<void> {
    // Prevent concurrent checks
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      if (!isNotificationSupported()) {
        return;
      }

      const permission = checkNotificationPermission();
      if (permission !== "granted") {
        return;
      }

      const settings = await getNotificationSettings();

      // If notifications disabled globally, skip
      if (!settings.enabled) {
        return;
      }

      // Check quiet hours
      if (isInQuietHours(settings)) {
        return;
      }

      const now = new Date();
      this.lastCheck = now;

      // Get all uncompleted tasks with due dates
      const db = getDb();
      const tasks = await db.tasks
        .where("completed")
        .equals(0) // 0 = false in IndexedDB
        .toArray();

      // Filter to tasks with due dates that are enabled for notifications
      const tasksWithDueDates = tasks.filter(
        (task) => task.dueDate && task.notificationEnabled !== false
      );

      // Check each task
      for (const task of tasksWithDueDates) {
        await this.checkTask(task, now, settings.defaultReminder);
      }

      // Update app badge with count of due soon tasks
      await this.updateBadge();
    } catch (error) {
      console.error("Error in notification checker:", error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Update the app badge with the count of tasks due soon
   */
  private async updateBadge(): Promise<void> {
    try {
      const count = await getDueSoonCount();
      await setAppBadge(count);
    } catch (error) {
      console.error("Error updating app badge:", error);
    }
  }

  /**
   * Check a single task and send notification if needed
   */
  private async checkTask(
    task: TaskRecord,
    now: Date,
    defaultReminder: number
  ): Promise<void> {
    if (!task.dueDate) {
      return;
    }

    const dueDate = new Date(task.dueDate);
    const minutesUntil = TIME_UTILS.msToMinutes(dueDate.getTime() - now.getTime());

    // Determine notification window (use task-specific or default)
    const notifyBefore = task.notifyBefore ?? defaultReminder;

    // Check if we should notify
    const shouldNotify =
      minutesUntil <= notifyBefore && // Within notification window
      minutesUntil > NOTIFICATION_TIMING.OVERDUE_NOTIFICATION_THRESHOLD && // Not more than 1 hour overdue (to avoid spam)
      !task.notificationSent; // Haven't sent notification yet

    if (!shouldNotify) {
      return;
    }

    // Check if snoozed
    if (task.snoozedUntil) {
      const snoozeDate = new Date(task.snoozedUntil);
      if (snoozeDate > now) {
        return; // Still snoozed
      }
    }

    // Send notification
    await showTaskNotification(task, minutesUntil);

    // Mark as notified
    await this.markNotificationSent(task.id);
  }

  /**
   * Mark a task as having received a notification
   */
  private async markNotificationSent(taskId: string): Promise<void> {
    const db = getDb();
    const task = await db.tasks.get(taskId);

    if (!task) {
      return;
    }

    const updated: TaskRecord = {
      ...task,
      notificationSent: true,
      lastNotificationAt: isoNow(),
      updatedAt: isoNow()
    };

    await db.tasks.put(updated);
  }

  /**
   * Start the notification checker
   * @param intervalMinutes - How often to check (in minutes)
   */
  start(intervalMinutes: number = NOTIFICATION_TIMING.DEFAULT_CHECK_INTERVAL_MINUTES): void {
    // Stop any existing interval
    this.stop();

    // Check immediately
    this.checkAndNotify();

    // Set up interval to check periodically
    this.intervalId = setInterval(() => {
      this.checkAndNotify();
    }, intervalMinutes * NOTIFICATION_TIMING.MS_PER_MINUTE);

    console.log(`Notification checker started (checking every ${intervalMinutes} minute(s))`);
  }

  /**
   * Stop the notification checker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Notification checker stopped");
    }
  }

  /**
   * Check if the checker is currently running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get the last time the checker ran
   */
  getLastCheckTime(): Date | null {
    return this.lastCheck;
  }
}

// Export singleton instance
export const notificationChecker = new NotificationChecker();

/**
 * Reset notification state for a task (e.g., when due date changes)
 */
export async function resetTaskNotification(taskId: string): Promise<void> {
  const db = getDb();
  const task = await db.tasks.get(taskId);

  if (!task) {
    return;
  }

  const updated: TaskRecord = {
    ...task,
    notificationSent: false,
    lastNotificationAt: undefined,
    snoozedUntil: undefined,
    updatedAt: isoNow()
  };

  await db.tasks.put(updated);
}

/**
 * Snooze a task notification for a specified duration
 * @param taskId - The task ID
 * @param minutes - How many minutes to snooze
 */
export async function snoozeTaskNotification(
  taskId: string,
  minutes: number
): Promise<void> {
  const db = getDb();
  const task = await db.tasks.get(taskId);

  if (!task) {
    return;
  }

  const snoozeUntil = new Date();
  snoozeUntil.setMinutes(snoozeUntil.getMinutes() + minutes);

  const updated: TaskRecord = {
    ...task,
    snoozedUntil: snoozeUntil.toISOString(),
    notificationSent: false, // Reset so it can notify again after snooze
    updatedAt: isoNow()
  };

  await db.tasks.put(updated);
}

/**
 * Get count of tasks that are due soon (within notification window)
 * Used for badge display
 */
export async function getDueSoonCount(): Promise<number> {
  const settings = await getNotificationSettings();
  const db = getDb();

  const tasks = await db.tasks
    .where("completed")
    .equals(0)
    .toArray();

  const now = new Date();
  let count = 0;

  for (const task of tasks) {
    if (!task.dueDate || task.notificationEnabled === false) {
      continue;
    }

    const dueDate = new Date(task.dueDate);
    const minutesUntil = TIME_UTILS.msToMinutes(dueDate.getTime() - now.getTime());
    const notifyBefore = task.notifyBefore ?? settings.defaultReminder;

    // Count tasks within notification window
    if (minutesUntil <= notifyBefore && minutesUntil > NOTIFICATION_TIMING.OVERDUE_NOTIFICATION_THRESHOLD) {
      count++;
    }
  }

  return count;
}
