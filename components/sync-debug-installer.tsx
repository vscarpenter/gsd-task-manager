"use client";

import { useEffect } from 'react';
import { installSyncDebugTools } from '@/lib/sync/debug';

/**
 * Installs sync debug tools on window.syncDebug
 * Only runs in development mode for security
 */
export function SyncDebugInstaller() {
  useEffect(() => {
    // Only install debug tools in development environment
    if (process.env.NODE_ENV === 'development') {
      installSyncDebugTools();
    }
  }, []);

  return null;
}
