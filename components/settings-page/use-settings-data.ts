"use client";

import { useEffect, useState } from "react";

import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/notifications";
import type { AppPreferences, NotificationSettings } from "@/lib/types";
import { getSyncStatus } from "@/lib/sync/config";
import { createLogger } from "@/lib/logger";
import {
  APP_PREFERENCES_EVENT,
  getAppPreferences,
  updateAppPreferences,
  type AppPreferencesEventDetail,
} from "@/lib/smart-views";
import {
  SHOW_COMPLETED_EVENT,
  SHOW_COMPLETED_KEY,
  readShowCompleted,
} from "@/lib/preferences/show-completed";

const logger = createLogger("UI");

export interface SettingsData {
  dataLoaded: boolean;
  showCompleted: boolean;
  appPreferences: AppPreferences | null;
  notificationSettings: NotificationSettings | null;
  syncEnabled: boolean;
  pendingSync: number;
  toggleCompleted: () => void;
  toggleSmartViews: () => Promise<void>;
  notificationToggle: () => Promise<void>;
  defaultReminderChange: (value: string) => Promise<void>;
  markAccountDeleted: () => void;
}

/**
 * Loads and owns all of the settings page's async-sourced state
 * (notifications, app preferences, sync status, show-completed) plus the
 * handlers that mutate them. Extracted from the page shell so the shell stays
 * a thin layout component.
 */
export function useSettingsData(): SettingsData {
  const [showCompleted, setShowCompleted] = useState(false);
  const [appPreferences, setAppPreferences] = useState<AppPreferences | null>(null);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [notif, sync, prefs] = await Promise.all([
          getNotificationSettings(),
          getSyncStatus(),
          getAppPreferences(),
        ]);
        if (cancelled) return;
        setNotificationSettings(notif);
        setAppPreferences(prefs);
        setSyncEnabled(sync.enabled);
        setPendingSync(sync.pendingCount);
        setShowCompleted(readShowCompleted());
        setDataLoaded(true);
      } catch (error) {
        logger.error(
          "Failed to load settings data",
          error instanceof Error ? error : undefined,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCompleted = () => {
    setShowCompleted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(SHOW_COMPLETED_KEY, String(next));
        window.dispatchEvent(
          new CustomEvent(SHOW_COMPLETED_EVENT, { detail: { show: next } }),
        );
      }
      return next;
    });
  };

  const toggleSmartViews = async () => {
    if (!appPreferences) return;
    const updated = await updateAppPreferences({
      smartViewsEnabled: !appPreferences.smartViewsEnabled,
    });
    setAppPreferences(updated);
    window.dispatchEvent(
      new CustomEvent<AppPreferencesEventDetail>(APP_PREFERENCES_EVENT, {
        detail: { preferences: updated },
      }),
    );
  };

  const reloadNotificationSettings = async () => {
    setNotificationSettings(await getNotificationSettings());
  };

  const notificationToggle = async () => {
    if (!notificationSettings) return;
    const newEnabled = !notificationSettings.enabled;
    if (newEnabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    await updateNotificationSettings({ enabled: newEnabled });
    await reloadNotificationSettings();
  };

  const defaultReminderChange = async (value: string) => {
    await updateNotificationSettings({ defaultReminder: Number.parseInt(value, 10) });
    await reloadNotificationSettings();
  };

  const markAccountDeleted = () => {
    setSyncEnabled(false);
    setPendingSync(0);
  };

  return {
    dataLoaded,
    showCompleted,
    appPreferences,
    notificationSettings,
    syncEnabled,
    pendingSync,
    toggleCompleted,
    toggleSmartViews,
    notificationToggle,
    defaultReminderChange,
    markAccountDeleted,
  };
}
