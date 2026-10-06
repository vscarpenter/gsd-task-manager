"use client";

import { SyncProvider } from "@/lib/sync/sync-provider";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useNotificationChecker } from "@/lib/use-notification-checker";

/**
 * Client-side layout wrapper
 *
 * Mounts the SyncProvider so sync lifecycle (health monitor,
 * background sync, status polling) is managed once at the app
 * level instead of per-component. Reminders and the trash and
 * archive sweep run here too, so they keep working on every route.
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  useAutoArchive();
  useNotificationChecker();

  return (
    <SyncProvider>
      {children}
    </SyncProvider>
  );
}
