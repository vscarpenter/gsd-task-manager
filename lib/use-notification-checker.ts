import { useEffect } from "react";
import { notificationChecker } from "@/lib/notification-checker";

/**
 * Hook to start and stop the notification checker for the active view.
 */
export function useNotificationChecker(): void {
  useEffect(() => {
    notificationChecker.start();
    return () => {
      notificationChecker.stop();
    };
  }, []);
}
