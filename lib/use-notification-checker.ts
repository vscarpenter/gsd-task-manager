import { useEffect } from "react";
import { notificationChecker } from "@/lib/notification-checker";

/**
 * Hook to start and stop the notification checker. Mounted once, app-wide, in ClientLayout.
 */
export function useNotificationChecker(): void {
  useEffect(() => {
    notificationChecker.start();
    return () => {
      notificationChecker.stop();
    };
  }, []);
}
