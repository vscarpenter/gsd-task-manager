"use client";

import { useEffect } from 'react';
import { installSyncDebugTools } from '@/lib/sync/debug';

/**
 * Installs sync debug tools on window.syncDebug
 * Only runs in development or when explicitly enabled
 */
export function SyncDebugInstaller() {
  useEffect(() => {
    // Always install debug tools (production enabled for debugging sync issues)
    // TODO: Remove production access after sync issues are resolved
    installSyncDebugTools();
  }, []);

  return null;
}
