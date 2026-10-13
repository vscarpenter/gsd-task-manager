"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { NOTIFICATION_TIMING } from "@/lib/constants";
import { getDb } from "@/lib/db";

/**
 * The offset, in minutes, that a task with reminders on but no `notifyBefore` of its own
 * fires at: the default from Settings, or the built-in default before one is stored.
 * Read-only and live, so the editor shows the same value the notification checker uses.
 */
export function useDefaultReminder(): number {
  const settings = useLiveQuery(() => getDb().notificationSettings.get("settings"));
  const stored = settings?.defaultReminder;
  return typeof stored === "number" ? stored : NOTIFICATION_TIMING.DEFAULT_REMINDER_MINUTES;
}
