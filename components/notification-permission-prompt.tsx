"use client";

import { useState, useEffect, useCallback } from "react";
import { BellIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  shouldAskForPermission,
  requestNotificationPermission,
  getNotificationSettings,
  updateNotificationSettings
} from "@/lib/notifications";

/**
 * Non-intrusive banner that prompts users to enable notifications
 * Shows when:
 * - User hasn't been asked before
 * - Permission is in "default" state
 * - User has tasks with due dates
 */
export function NotificationPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkShouldShow = useCallback(async () => {
    // Don't show if already dismissed in this session
    if (isDismissed) {
      return;
    }

    const should = await shouldAskForPermission();
    setShowPrompt(should);
  }, [isDismissed]);

  useEffect(() => {
    checkShouldShow();
  }, [checkShouldShow]);

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setShowPrompt(false);
      const settings = await getNotificationSettings();
      await updateNotificationSettings({ ...settings, enabled: true });
    } else {
      // Permission denied, mark as asked and hide prompt
      setShowPrompt(false);
    }
  };

  const handleDismiss = async () => {
    setIsDismissed(true);
    setShowPrompt(false);

    // Mark that we've asked (so we don't annoy them again)
    const settings = await getNotificationSettings();
    await updateNotificationSettings({ ...settings, permissionAsked: true });
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="animate-in slide-in-from-top duration-300 border-b border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <div className="container mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white">
              <BellIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Enable Notifications
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Get notified when your tasks are due so you never miss a deadline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleEnable}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Enable
            </Button>
            <button
              onClick={handleDismiss}
              className="rounded-lg p-2 text-blue-700 transition-colors hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
              aria-label="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
