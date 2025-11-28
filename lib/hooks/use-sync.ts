"use client";

import { useState, useCallback, useEffect } from 'react';
import { getSyncEngine } from '@/lib/sync/engine';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getHealthMonitor } from '@/lib/sync/health-monitor';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { UI_TIMING } from '@/lib/constants/ui';
import { createLogger } from '@/lib/logger';
import type { SyncResult } from '@/lib/sync/types';

const logger = createLogger('SYNC_ENGINE');

export interface UseSyncResult {
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastResult: SyncResult | null;
  status: 'idle' | 'syncing' | 'success' | 'error' | 'conflict';
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
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'conflict'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncInterval, setAutoSyncInterval] = useState(2);

  // Check if sync is enabled on mount and periodically
  // Start/stop health monitor and background sync manager based on sync enabled state
  useEffect(() => {
    const checkEnabled = async () => {
      const engine = getSyncEngine();
      const enabled = await engine.isEnabled();
      setIsEnabled(enabled);

      // Start or stop health monitor based on sync state
      const healthMonitor = getHealthMonitor();
      if (enabled && !healthMonitor.isActive()) {
        logger.debug('Starting health monitor (sync enabled)');
        healthMonitor.start();
      } else if (!enabled && healthMonitor.isActive()) {
        logger.debug('Stopping health monitor (sync disabled)');
        healthMonitor.stop();
      }

      // Start or stop background sync manager
      const bgSyncManager = getBackgroundSyncManager();
      if (enabled) {
        const autoSyncConfig = await getAutoSyncConfig();

        if (autoSyncConfig.enabled && !bgSyncManager.isRunning()) {
          logger.debug('Starting background sync manager');
          await bgSyncManager.start(autoSyncConfig);
        } else if (!autoSyncConfig.enabled && bgSyncManager.isRunning()) {
          logger.debug('Stopping background sync manager (disabled in settings)');
          bgSyncManager.stop();
        }
      } else if (bgSyncManager.isRunning()) {
        logger.debug('Stopping background sync manager (sync disabled)');
        bgSyncManager.stop();
      }
    };

    checkEnabled();

    // Check periodically to detect auth changes
    const interval = setInterval(checkEnabled, UI_TIMING.AUTH_CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);

      // Stop health monitor on unmount
      const healthMonitor = getHealthMonitor();
      if (healthMonitor.isActive()) {
        healthMonitor.stop();
      }

      // Stop background sync manager on unmount
      const bgSyncManager = getBackgroundSyncManager();
      if (bgSyncManager.isRunning()) {
        bgSyncManager.stop();
      }
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

      // Update auto-sync config
      const autoConfig = await getAutoSyncConfig();
      setAutoSyncEnabled(autoConfig.enabled);
      setAutoSyncInterval(autoConfig.intervalMinutes);

      // Update last result if available
      if (coordStatus.lastResult) {
        setLastResult(coordStatus.lastResult);
      }

      // Update error state if there's a recent error
      if (coordStatus.lastError) {
        setError(coordStatus.lastError);
      }
    };

    updateStatus();

    // Poll for responsive UI updates
    const interval = setInterval(updateStatus, UI_TIMING.STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Listen for health check results and show notifications
  // This effect runs periodically to check health status
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let lastHealthCheckTime = 0;

    const checkHealth = async () => {
      const now = Date.now();

      // Only check once per interval to avoid spam
      if (now - lastHealthCheckTime < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS) {
        return;
      }

      lastHealthCheckTime = now;

      const healthMonitor = getHealthMonitor();
      const report = await healthMonitor.check();

      // Log health check results
      logger.debug('Health check result', {
        healthy: report.healthy,
        issuesCount: report.issues.length,
      });

      // Note: Toast notifications would be shown here if we had access to the toast context
      // For now, we just log the issues. The health monitor integration is complete,
      // and toast notifications can be added by components that use this hook.
      if (!report.healthy && report.issues.length > 0) {
        for (const issue of report.issues) {
          logger.warn('Health issue detected', {
            type: issue.type,
            severity: issue.severity,
            message: issue.message,
            suggestedAction: issue.suggestedAction,
          });
        }
      }
    };

    // Run initial check after a short delay
    const initialTimeout = setTimeout(checkHealth, UI_TIMING.INITIAL_HEALTH_CHECK_DELAY_MS);

    // Check periodically
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
      // User-triggered sync bypasses retry backoff
      await coordinator.requestSync('user');

      // Get the final status after sync completes
      const coordStatus = await coordinator.getStatus();

      // Use the actual result from coordinator
      if (coordStatus.lastResult) {
        setLastResult(coordStatus.lastResult);

        if (coordStatus.lastResult.status === 'success') {
          setStatus('success');
        } else if (coordStatus.lastResult.status === 'conflict') {
          setStatus('conflict');
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

      // Auto-reset status to idle
      setTimeout(() => {
        setStatus('idle');
      }, UI_TIMING.AUTO_RESET_TIMEOUT_MS);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setStatus('error');
      setError(errorMessage);
      setLastResult({ status: 'error', error: errorMessage });

      // Auto-reset after timeout
      setTimeout(() => {
        setStatus('idle');
      }, UI_TIMING.AUTO_RESET_TIMEOUT_MS);
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
