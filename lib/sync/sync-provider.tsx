"use client";

import {
  createContext,
  use,
  useReducer,
  useEffect,
  type ReactNode,
} from 'react';
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

export interface SyncState {
  /** Trigger a manual sync. Returns the result directly (no stale closure). */
  sync: () => Promise<PBSyncResult>;
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
  /** Timestamp of the most recent successful sync, or null if never synced. */
  lastSuccessfulSyncAt: string | null;
}

const SyncContext = createContext<SyncState | null>(null);

/** Internal reducer state — mirrors the readable fields of SyncState. */
interface SyncReducerState {
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
  lastSuccessfulSyncAt: string | null;
}

const initialSyncState: SyncReducerState = {
  isSyncing: false,
  lastResult: null,
  status: 'idle',
  error: null,
  isEnabled: false,
  pendingRequests: 0,
  nextRetryAt: null,
  retryCount: 0,
  autoSyncEnabled: true,
  autoSyncInterval: 2,
  lastSuccessfulSyncAt: null,
};

type SyncAction =
  | { type: 'SET_ENABLED'; isEnabled: boolean }
  | {
      type: 'SET_COORDINATOR_STATUS';
      isSyncing: boolean;
      pendingRequests: number;
      nextRetryAt: number | null;
      retryCount: number;
      lastSuccessfulSyncAt: string | null;
    }
  | { type: 'SET_AUTO_SYNC'; autoSyncEnabled: boolean; autoSyncInterval: number }
  | { type: 'SET_LAST_RESULT'; lastResult: PBSyncResult }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_STATUS'; status: SyncReducerState['status'] }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_SUCCESS'; lastResult: PBSyncResult }
  | { type: 'SYNC_IDLE'; lastResult: PBSyncResult }
  | { type: 'SYNC_ERROR'; error: string; lastResult: PBSyncResult };

function syncReducer(state: SyncReducerState, action: SyncAction): SyncReducerState {
  switch (action.type) {
    case 'SET_ENABLED':
      return { ...state, isEnabled: action.isEnabled };
    case 'SET_COORDINATOR_STATUS':
      return {
        ...state,
        isSyncing: action.isSyncing,
        pendingRequests: action.pendingRequests,
        nextRetryAt: action.nextRetryAt,
        retryCount: action.retryCount,
        lastSuccessfulSyncAt: action.lastSuccessfulSyncAt,
      };
    case 'SET_AUTO_SYNC':
      return {
        ...state,
        autoSyncEnabled: action.autoSyncEnabled,
        autoSyncInterval: action.autoSyncInterval,
      };
    case 'SET_LAST_RESULT':
      return { ...state, lastResult: action.lastResult };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SYNC_START':
      return { ...state, status: 'syncing', error: null };
    case 'SYNC_SUCCESS':
      return { ...state, status: 'success', lastResult: action.lastResult };
    case 'SYNC_IDLE':
      return { ...state, status: 'idle', lastResult: action.lastResult };
    case 'SYNC_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.error,
        lastResult: action.lastResult,
      };
    default:
      return state;
  }
}

/**
 * App-level provider that owns all sync lifecycle management.
 *
 * Mount once in ClientLayout. This replaces the per-component
 * lifecycle effects that previously ran in every useSync() consumer,
 * eliminating race conditions from multiple health-monitor and
 * background-sync starts/stops.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, initialSyncState);
  const { isEnabled } = state;

  // Single lifecycle owner for health monitor and background sync
  useEffect(() => {
    const checkEnabled = async () => {
      const pbAuthenticated = isAuthenticated();
      const db = getDb();
      const config = await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined;
      const enabled = pbAuthenticated && !!config?.enabled;
      dispatch({ type: 'SET_ENABLED', isEnabled: enabled });

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

      dispatch({
        type: 'SET_COORDINATOR_STATUS',
        isSyncing: coordStatus.isRunning,
        pendingRequests: coordStatus.pendingRequests,
        nextRetryAt: coordStatus.nextRetryAt,
        retryCount: coordStatus.retryCount,
        lastSuccessfulSyncAt: coordStatus.lastSuccessfulSyncAt,
      });

      const autoConfig = await getAutoSyncConfig();
      dispatch({
        type: 'SET_AUTO_SYNC',
        autoSyncEnabled: autoConfig.enabled,
        autoSyncInterval: autoConfig.intervalMinutes,
      });

      if (coordStatus.lastResult) {
        dispatch({ type: 'SET_LAST_RESULT', lastResult: coordStatus.lastResult });
      }

      if (coordStatus.lastError) {
        dispatch({ type: 'SET_ERROR', error: coordStatus.lastError });
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

  const sync = async (): Promise<PBSyncResult> => {
    dispatch({ type: 'SYNC_START' });

    try {
      const coordinator = getSyncCoordinator();
      await coordinator.requestSync('user');

      const coordStatus = await coordinator.getStatus();
      let result: PBSyncResult;

      if (coordStatus.lastResult) {
        result = coordStatus.lastResult;

        if (result.status === 'success') {
          dispatch({ type: 'SYNC_SUCCESS', lastResult: result });
          setTimeout(() => dispatch({ type: 'SET_STATUS', status: 'idle' }), UI_TIMING.AUTO_RESET_SUCCESS_MS);
        } else if (result.status === 'already_running') {
          // Dedup signal -- not an error, just go back to idle
          dispatch({ type: 'SYNC_IDLE', lastResult: result });
        } else {
          // 'error' or 'partial' -- both are error-like states
          dispatch({ type: 'SYNC_ERROR', error: result.error || 'Sync failed', lastResult: result });
          setTimeout(() => dispatch({ type: 'SET_STATUS', status: 'idle' }), UI_TIMING.AUTO_RESET_ERROR_MS);
        }
      } else if (coordStatus.lastError) {
        result = { status: 'error', error: coordStatus.lastError };
        dispatch({ type: 'SYNC_ERROR', error: coordStatus.lastError, lastResult: result });
        setTimeout(() => dispatch({ type: 'SET_STATUS', status: 'idle' }), UI_TIMING.AUTO_RESET_ERROR_MS);
      } else {
        result = { status: 'success' };
        dispatch({ type: 'SYNC_SUCCESS', lastResult: result });
        setTimeout(() => dispatch({ type: 'SET_STATUS', status: 'idle' }), UI_TIMING.AUTO_RESET_SUCCESS_MS);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      const result: PBSyncResult = { status: 'error', error: errorMessage };
      dispatch({ type: 'SYNC_ERROR', error: errorMessage, lastResult: result });

      setTimeout(() => dispatch({ type: 'SET_STATUS', status: 'idle' }), UI_TIMING.AUTO_RESET_ERROR_MS);
      return result;
    }
  };

  const value: SyncState = {
    sync,
    ...state,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

/**
 * Consumer hook -- reads sync state from the nearest SyncProvider.
 * Must be used within a SyncProvider.
 */
export function useSyncContext(): SyncState {
  const context = use(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}
