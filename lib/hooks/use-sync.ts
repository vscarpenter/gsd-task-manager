"use client";

import { useState, useCallback, useEffect } from 'react';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getHealthMonitor } from '@/lib/sync/health-monitor';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
import { isAuthenticated } from '@/lib/sync/pocketbase-client';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { UI_TIMING } from '@/lib/constants/ui';
import { createLogger } from '@/lib/logger';
import type { PBSyncResult, PBSyncConfig } from '@/lib/sync/types';
import { getDb } from '@/lib/db';

const logger = createLogger('SYNC_ENGINE');

export interface UseSyncResult {
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastResult: PBSyncResult | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  error: string | null;
  isEnabled: boolean;
  pendingRequests: number;
  nextRetryAt: number | null;
  retryCount: number;
  autoSyncEnabled: boolean;
  autoSyncInterval: number;
}

export function useSync(): UseSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<PBSyncResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncInterval, setAutoSyncInterval] = useState(2);

  // Check if sync is enabled: PB auth valid + config enabled in IndexedDB
  useEffect(() => {
    const checkEnabled = async () => {
      const pbAuthenticated = isAuthenticated();
      const db = getDb();
      const config = await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined;
      const enabled = pbAuthenticated && !!config?.enabled;
      setIsEnabled(enabled);

      // Start or stop health monitor based on sync state
      const healthMonitor = getHealthMonitor();
      if (enabled && !healthMonitor.isActive()) {
        healthMonitor.start();
      } else if (!enabled && healthMonitor.isActive()) {
        healthMonitor.stop();
      }

      // Start or stop background sync manager
      const bgSyncManager = getBackgroundSyncManager();
      if (enabled) {
        const autoSyncConfig = await getAutoSyncConfig();

        if (autoSyncConfig.enabled && !bgSyncManager.isRunning()) {
          logger.debug('Starting background sync manager');
          await bgSyncManager.start(autoSyncConfig, config?.deviceId);
        } else if (!autoSyncConfig.enabled && bgSyncManager.isRunning()) {
          bgSyncManager.stop();
        }
      } else if (bgSyncManager.isRunning()) {
        bgSyncManager.stop();
      }
    };

    checkEnabled();
    const interval = setInterval(checkEnabled, UI_TIMING.AUTH_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      const healthMonitor = getHealthMonitor();
      if (healthMonitor.isActive()) healthMonitor.stop();
      const bgSyncManager = getBackgroundSyncManager();
      if (bgSyncManager.isRunning()) bgSyncManager.stop();
    };
  }, []);

  // Poll coordinator status to update UI
  useEffect(() => {
    const updateStatus = async () => {
      const coordinator = getSyncCoordinator();
      const coordStatus = await coordinator.getStatus();

      setIsSyncing(coordStatus.isRunning);
      setPendingRequests(coordStatus.pendingRequests);
      setNextRetryAt(coordStatus.nextRetryAt);
      setRetryCount(coordStatus.retryCount);

      const autoConfig = await getAutoSyncConfig();
      setAutoSyncEnabled(autoConfig.enabled);
      setAutoSyncInterval(autoConfig.intervalMinutes);

      if (coordStatus.lastResult) {
        setLastResult(coordStatus.lastResult);
      }

      if (coordStatus.lastError) {
        setError(coordStatus.lastError);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, UI_TIMING.STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Health monitoring
  useEffect(() => {
    if (!isEnabled) return;

    let lastHealthCheckTime = 0;

    const checkHealth = async () => {
      const now = Date.now();
      if (now - lastHealthCheckTime < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS) return;

      lastHealthCheckTime = now;
      const healthMonitor = getHealthMonitor();
      const report = await healthMonitor.check();

      if (!report.healthy && report.issues.length > 0) {
        for (const issue of report.issues) {
          logger.warn('Health issue detected', {
            type: issue.type,
            severity: issue.severity,
            message: issue.message,
          });
        }
      }
    };

    const initialTimeout = setTimeout(checkHealth, UI_TIMING.INITIAL_HEALTH_CHECK_DELAY_MS);
    const interval = setInterval(checkHealth, SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isEnabled]);

  const sync = useCallback(async () => {
    setStatus('syncing');
    setError(null);

    try {
      const coordinator = getSyncCoordinator();
      await coordinator.requestSync('user');

      const coordStatus = await coordinator.getStatus();

      if (coordStatus.lastResult) {
        setLastResult(coordStatus.lastResult);

        if (coordStatus.lastResult.status === 'success') {
          setStatus('success');
        } else if (coordStatus.lastResult.status === 'error') {
          setStatus('error');
          setError(coordStatus.lastResult.error || 'Sync failed');
        }
      } else if (coordStatus.lastError) {
        setStatus('error');
        setError(coordStatus.lastError);
        setLastResult({ status: 'error', error: coordStatus.lastError });
      } else {
        setStatus('success');
        setLastResult({ status: 'success' });
      }

      setTimeout(() => setStatus('idle'), UI_TIMING.AUTO_RESET_TIMEOUT_MS);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setStatus('error');
      setError(errorMessage);
      setLastResult({ status: 'error', error: errorMessage });

      setTimeout(() => setStatus('idle'), UI_TIMING.AUTO_RESET_TIMEOUT_MS);
    }
  }, []);

  return {
    sync,
    isSyncing,
    lastResult,
    status,
    error,
    isEnabled,
    pendingRequests,
    nextRetryAt,
    retryCount,
    autoSyncEnabled,
    autoSyncInterval,
  };
}
