import { useState, useEffect, useCallback } from "react";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/notifications";
import { getSyncConfig } from "@/lib/sync/config";

/**
 * Hook to manage quick settings panel state
 *
 * Provides access to frequently-adjusted settings without opening full settings dialog
 */
export function useQuickSettings() {
  const [showCompleted, setShowCompleted] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncIntervalState] = useState(5);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Load notification settings
      const notifSettings = await getNotificationSettings();
      setNotificationsEnabled(notifSettings.enabled);

      // Load sync settings
      const syncConfig = await getSyncConfig();
      setIsSyncEnabled(syncConfig?.enabled || false);

      if (syncConfig?.enabled && syncConfig.autoSyncEnabled !== undefined) {
        setAutoSyncEnabled(syncConfig.autoSyncEnabled);
        setSyncIntervalState(syncConfig.autoSyncIntervalMinutes || 5);
      }
    };

    loadSettings();

    // Listen for external show completed changes
    const handleToggleCompleted = (event: CustomEvent) => {
      setShowCompleted(event.detail.show);
    };

    window.addEventListener('toggle-completed', handleToggleCompleted as EventListener);
    return () => window.removeEventListener('toggle-completed', handleToggleCompleted as EventListener);
  }, []);

  const toggleShowCompleted = useCallback(() => {
    const newValue = !showCompleted;
    setShowCompleted(newValue);

    // Emit event for MatrixBoard to listen to
    window.dispatchEvent(new CustomEvent('toggle-completed', {
      detail: { show: newValue }
    }));
  }, [showCompleted]);

  const toggleNotifications = useCallback(async () => {
    const newValue = !notificationsEnabled;

    // Request permission if enabling
    if (newValue && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return; // Don't enable if permission denied
      }
    }

    await updateNotificationSettings({ enabled: newValue });
    setNotificationsEnabled(newValue);
  }, [notificationsEnabled]);

  const setSyncInterval = useCallback(async (minutes: number) => {
    setSyncIntervalState(minutes);

    // Update sync config
    const { updateSyncConfig } = await import('@/lib/sync/config');
    await updateSyncConfig({ autoSyncIntervalMinutes: minutes });
  }, []);

  return {
    showCompleted,
    toggleShowCompleted,
    notificationsEnabled,
    toggleNotifications,
    isSyncEnabled,
    autoSyncEnabled,
    syncInterval,
    setSyncInterval
  };
}
