import { NOTIFICATION_TIMING } from "@/lib/constants";
import { getDb } from "@/lib/db";

/**
 * This device's default reminder offset, in minutes. Read-only: unlike
 * `getNotificationSettings`, it never writes the settings row, so it is safe
 * to call on any write path.
 */
export async function readDefaultReminder(): Promise<number> {
  const settings = await getDb().notificationSettings.get("settings");
  const stored = settings?.defaultReminder;
  return typeof stored === "number" ? stored : NOTIFICATION_TIMING.DEFAULT_REMINDER_MINUTES;
}
