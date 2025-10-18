"use client";

import { useState, useCallback, useEffect } from 'react';
import { getSyncEngine } from '@/lib/sync/engine';
import type { SyncResult } from '@/lib/sync/types';

export interface UseSyncResult {
  sync: () => Promise<SyncResult | null>;
  isSyncing: boolean;
  lastResult: SyncResult | null;
  status: 'idle' | 'syncing' | 'success' | 'error' | 'conflict';
  error: string | null;
  isEnabled: boolean;
}

export function useSync(): UseSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'conflict'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Check if sync is enabled on mount and periodically
  useEffect(() => {
    const checkEnabled = async () => {
      const engine = getSyncEngine();
      const enabled = await engine.isEnabled();
      setIsEnabled(enabled);
    };

    checkEnabled();

    // Check every 2 seconds to detect auth changes
    const interval = setInterval(checkEnabled, 2000);
    return () => clearInterval(interval);
  }, []);

  const sync = useCallback(async () => {
    if (isSyncing) {
      return null;
    }

    setIsSyncing(true);
    setStatus('syncing');
    setError(null);

    try {
      const engine = getSyncEngine();
      const result = await engine.sync();

      setLastResult(result);

      // Update status based on result
      if (result.status === 'success') {
        setStatus('success');
      } else if (result.status === 'conflict') {
        setStatus('conflict');
      } else if (result.status === 'error') {
        setStatus('error');
        setError(result.error || 'Sync failed');
      } else if (result.status === 'already_running') {
        setStatus('idle');
        return result;
      }

      // Auto-reset status to idle after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setStatus('error');
      setError(errorMessage);
      setLastResult({ status: 'error', error: errorMessage });

      // Auto-reset after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);

      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return {
    sync,
    isSyncing,
    lastResult,
    status,
    error,
    isEnabled,
  };
}
