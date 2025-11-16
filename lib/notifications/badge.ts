"use client";

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
