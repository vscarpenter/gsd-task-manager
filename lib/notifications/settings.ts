"use client";

import { getDb } from "@/lib/db";
import type { NotificationSettings } from "@/lib/types";
import { notificationSettingsSchema } from "@/lib/schema";
import { NOTIFICATION_TIMING } from "@/lib/constants";

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
