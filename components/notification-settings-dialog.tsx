"use client";

import { useState, useEffect } from "react";
import { BellIcon, BellOffIcon, Volume2Icon, VolumeXIcon, MoonIcon, TestTubeIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  getNotificationSettings,
  updateNotificationSettings,
  requestNotificationPermission,
  checkNotificationPermission,
  showTestNotification
} from "@/lib/notifications";
import type { NotificationSettings } from "@/lib/types";

interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Reminder time options in minutes
const REMINDER_OPTIONS = [
  { label: "No reminder", value: 0 },
  { label: "At due time", value: 0 },
  { label: "5 minutes before", value: 5 },
  { label: "15 minutes before", value: 15 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "2 hours before", value: 120 },
  { label: "1 day before", value: 1440 }
];

export function NotificationSettingsDialog({ open, onOpenChange }: NotificationSettingsDialogProps) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      loadSettings();
      setPermission(checkNotificationPermission());
    }
  }, [open]);

  const loadSettings = async () => {
    const current = await getNotificationSettings();
    setSettings(current);
  };

  const handleSave = async (updates: Partial<NotificationSettings>) => {
    if (!settings) return;

    setIsSaving(true);
    try {
      await updateNotificationSettings(updates);
      await loadSettings(); // Reload to get updated values
    } catch (error) {
      console.error("Error saving settings:", error);
      window.alert("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setPermission("granted");
      await handleSave({ enabled: true });
    } else {
      window.alert("Notification permission was denied. Please enable notifications in your browser settings.");
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const success = await showTestNotification();
      if (!success) {
        window.alert("Failed to show test notification. Please check your notification permissions.");
      }
    } catch (error) {
      console.error("Error showing test notification:", error);
    } finally {
      setIsTesting(false);
    }
  };

  if (!settings) {
    return null;
  }

  const isPermissionGranted = permission === "granted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Configure how and when you receive task reminders
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Permission Status */}
          {!isPermissionGranted && (
            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-start gap-3">
                <BellOffIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    Notifications Disabled
                  </h3>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    Enable notifications to receive reminders when tasks are due.
                  </p>
                  <Button
                    onClick={handleEnableNotifications}
                    className="mt-3 text-sm"
                  >
                    <BellIcon className="mr-2 h-4 w-4" />
                    Enable Notifications
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Master toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <BellIcon className="h-5 w-5 text-foreground-muted" />
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-sm text-foreground-muted">
                  {settings.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              disabled={!isPermissionGranted || isSaving}
              onClick={() => handleSave({ enabled: !settings.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                settings.enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Default reminder time */}
          <div className="space-y-2">
            <Label htmlFor="defaultReminder">Default Reminder Time</Label>
            <select
              id="defaultReminder"
              value={settings.defaultReminder}
              onChange={(e) => handleSave({ defaultReminder: Number(e.target.value) })}
              disabled={!settings.enabled || !isPermissionGranted || isSaving}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-foreground-muted">
              You can override this for individual tasks
            </p>
          </div>

          {/* Sound toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              {settings.soundEnabled ? (
                <Volume2Icon className="h-5 w-5 text-foreground-muted" />
              ) : (
                <VolumeXIcon className="h-5 w-5 text-foreground-muted" />
              )}
              <div>
                <p className="font-medium">Notification Sound</p>
                <p className="text-sm text-foreground-muted">
                  {settings.soundEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.soundEnabled}
              disabled={!settings.enabled || !isPermissionGranted || isSaving}
              onClick={() => handleSave({ soundEnabled: !settings.soundEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                settings.soundEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.soundEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Quiet hours */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MoonIcon className="h-4 w-4 text-foreground-muted" />
              <Label>Quiet Hours (Optional)</Label>
            </div>
            <p className="text-sm text-foreground-muted">
              No notifications will be sent during these hours
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quietStart" className="text-xs">
                  Start Time
                </Label>
                <Input
                  id="quietStart"
                  type="time"
                  value={settings.quietHoursStart || ""}
                  onChange={(e) => handleSave({ quietHoursStart: e.target.value || undefined })}
                  disabled={!settings.enabled || !isPermissionGranted || isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quietEnd" className="text-xs">
                  End Time
                </Label>
                <Input
                  id="quietEnd"
                  type="time"
                  value={settings.quietHoursEnd || ""}
                  onChange={(e) => handleSave({ quietHoursEnd: e.target.value || undefined })}
                  disabled={!settings.enabled || !isPermissionGranted || isSaving}
                />
              </div>
            </div>
          </div>

          {/* Test notification button */}
          <div className="border-t border-border pt-4">
            <Button
              onClick={handleTestNotification}
              disabled={!settings.enabled || !isPermissionGranted || isTesting}
              variant="subtle"
              className="w-full"
            >
              <TestTubeIcon className="mr-2 h-4 w-4" />
              {isTesting ? "Sending..." : "Send Test Notification"}
            </Button>
          </div>

          {/* Close button */}
          <Button
            variant="primary"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
