"use client";

import { getDb } from "@/lib/db";
import { modifyRow } from "@/lib/db-row";
import type { NotificationSettings } from "@/lib/types";
import { notificationSettingsSchema } from "@/lib/schema";
import { NOTIFICATION_TIMING } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const logger = createLogger("NOTIFICATION_SETTINGS");

function defaultSettings(): NotificationSettings {
  return {
    id: "settings",
    enabled: true,
    defaultReminder: NOTIFICATION_TIMING.DEFAULT_REMINDER_MINUTES,
    soundEnabled: true,
    permissionAsked: false,
    updatedAt: new Date().toISOString(),
  };
}

/** The stored row, or defaults when it is missing or corrupt. */
function usableSettings(stored: NotificationSettings | undefined): NotificationSettings {
  if (!stored) return defaultSettings();
  const result = notificationSettingsSchema.safeParse(stored);
  if (result.success) return result.data;
  logger.warn("Stored notification settings are corrupt, returning defaults", {
    issues: result.error.issues.map((i) => i.path.join(".")).join(", "),
  });
  return defaultSettings();
}

/**
 * Get notification settings from database
 * Creates default settings if none exist
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const table = getDb().notificationSettings;
  const result = notificationSettingsSchema.safeParse(await table.get("settings"));
  return result.success ? result.data : modifyRow(table, "settings", usableSettings);
}

/** Derive the change from the row as it is inside the write's transaction. */
async function changeNotificationSettings(
  change: (current: NotificationSettings) => Partial<NotificationSettings>,
): Promise<void> {
  await modifyRow(getDb().notificationSettings, "settings", (stored) => {
    const current = usableSettings(stored);
    const result = notificationSettingsSchema.safeParse({
      ...current,
      ...change(current),
      id: "settings",
      updatedAt: new Date().toISOString(),
    });
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Notification settings validation failed: invalid fields — ${fields}`);
    }
    return result.data;
  });
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  updates: Partial<NotificationSettings>
): Promise<void> {
  await changeNotificationSettings(() => updates);
}

/**
 * The window toggleQuietHours seeds, matching the native clients' 22:00 to 07:00 default.
 * It applies only when turning quiet hours on; a stored window is never rewritten.
 */
const DEFAULT_QUIET_HOURS = { start: "22:00", end: "07:00" } as const;

/** Flip whether notifications play a sound. */
export async function toggleNotificationSound(): Promise<void> {
  await changeNotificationSettings((current) => ({ soundEnabled: !current.soundEnabled }));
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
  await changeNotificationSettings((current) =>
    current.quietHoursStart && current.quietHoursEnd
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
