"use client";

import { SyncProvider } from "@/lib/sync/sync-provider";

/**
 * Client-side layout wrapper
 *
 * Mounts the SyncProvider so sync lifecycle (health monitor,
 * background sync, status polling) is managed once at the app
 * level instead of per-component.
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SyncProvider>
      {children}
    </SyncProvider>
  );
}
