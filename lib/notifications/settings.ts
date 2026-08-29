"use client";

import { getDb } from "@/lib/db";
import type { NotificationSettings } from "@/lib/types";
import { notificationSettingsSchema } from "@/lib/schema";
import { NOTIFICATION_TIMING } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const logger = createLogger("NOTIFICATION_SETTINGS");

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

  // Validate settings with schema — self-heal on corrupt data
  const result = notificationSettingsSchema.safeParse(settings);
  if (!result.success) {
    logger.warn("Stored notification settings are corrupt, returning defaults", {
      issues: result.error.issues.map((i) => i.path.join(".")).join(", "),
    });
    const defaultSettings: NotificationSettings = {
      id: "settings",
      enabled: true,
      defaultReminder: NOTIFICATION_TIMING.DEFAULT_REMINDER_MINUTES,
      soundEnabled: true,
      permissionAsked: false,
      updatedAt: new Date().toISOString(),
    };
    await db.notificationSettings.put(defaultSettings);
    return defaultSettings;
  }
  return result.data;
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
  const result = notificationSettingsSchema.safeParse(updated);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Notification settings validation failed: invalid fields — ${fields}`);
  }
  await db.notificationSettings.put(result.data);
}

/** The window toggleQuietHours seeds — the same overnight span the iOS client defaults to. */
const DEFAULT_QUIET_HOURS = { start: "22:00", end: "08:00" } as const;

/** Flip whether notifications play a sound. */
export async function toggleNotificationSound(): Promise<void> {
  const current = await getNotificationSettings();
  await updateNotificationSettings({ soundEnabled: !current.soundEnabled });
}

/**
 * Toggle the quiet-hours window.
 *
 * "On" is exactly the condition isInQuietHours() checks — both edges set — so
 * there is no separate flag to drift: turning on seeds the overnight window,
 * turning off clears both edges. A half-set state can never fire, so it reads
 * as off and toggling completes the window.
 */
export async function toggleQuietHours(): Promise<void> {
  const current = await getNotificationSettings();
  const isOn = Boolean(current.quietHoursStart && current.quietHoursEnd);
  await updateNotificationSettings(
    isOn
      ? { quietHoursStart: undefined, quietHoursEnd: undefined }
      : { quietHoursStart: DEFAULT_QUIET_HOURS.start, quietHoursEnd: DEFAULT_QUIET_HOURS.end },
  );
}

/** Move one edge of the quiet-hours window. An empty value is ignored — an emptied time input is not an edge. */
export async function setQuietHoursEdge(which: "start" | "end", value: string): Promise<void> {
  if (!value) return;
  await updateNotificationSettings(
    which === "start" ? { quietHoursStart: value } : { quietHoursEnd: value },
  );
}
