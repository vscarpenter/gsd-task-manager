"use client";

import { getNotificationSettings, updateNotificationSettings } from "./settings";

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
 * Check if current time is within quiet hours
 */
export function isInQuietHours(settings: { quietHoursStart?: string; quietHoursEnd?: string }): boolean {
  if (!settings.quietHoursStart || !settings.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = settings.quietHoursStart.split(":").map(Number);
  const [endHour, endMin] = settings.quietHoursEnd.split(":").map(Number);

  const quietStart = startHour * 60 + startMin;
  const quietEnd = endHour * 60 + endMin;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (quietStart > quietEnd) {
    return currentMinutes >= quietStart || currentMinutes < quietEnd;
  }

  // Normal quiet hours (e.g., 13:00 to 14:00)
  return currentMinutes >= quietStart && currentMinutes < quietEnd;
}
