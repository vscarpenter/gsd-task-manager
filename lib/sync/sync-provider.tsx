"use client";

import {
  createContext,
  use,
  useReducer,
  useEffect,
  type Dispatch,
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
import { subscribe, unsubscribe } from '@/lib/sync/pb-realtime';

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

async function reconcileRealtime(enabled: boolean, deviceId?: string): Promise<void> {
  if (!enabled || !deviceId) {
    unsubscribe();
    return;
  }
  try {
    await subscribe(deviceId);
  } catch (error) {
    logger.warn('Failed to start realtime sync', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function reconcileHealthMonitor(enabled: boolean): void {
  const monitor = getHealthMonitor();
  if (monitor.isActive() === enabled) return;
  if (enabled) monitor.start();
  else monitor.stop();
}

async function reconcileBackgroundSync(enabled: boolean, deviceId?: string): Promise<void> {
  const manager = getBackgroundSyncManager();
  if (!enabled) {
    if (manager.isRunning()) manager.stop();
    return;
  }
  const config = await getAutoSyncConfig();
  if (!config.enabled) {
    if (manager.isRunning()) manager.stop();
    return;
  }
  if (!manager.isRunning()) {
    logger.debug('Starting background sync manager');
    await manager.start(config, deviceId);
  }
}

async function reconcileSyncServices(): Promise<boolean> {
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined;
  const enabled = isAuthenticated() && Boolean(config?.enabled);
  await reconcileRealtime(enabled, config?.deviceId);
  reconcileHealthMonitor(enabled);
  await reconcileBackgroundSync(enabled, config?.deviceId);
  return enabled;
}

function stopSyncServices(): void {
  const healthMonitor = getHealthMonitor();
  if (healthMonitor.isActive()) healthMonitor.stop();
  const backgroundSync = getBackgroundSyncManager();
  if (backgroundSync.isRunning()) backgroundSync.stop();
  unsubscribe();
}

function useSyncLifecycle(dispatch: Dispatch<SyncAction>): void {
  useEffect(() => {
    const checkEnabled = async () => {
      const isEnabled = await reconcileSyncServices();
      dispatch({ type: 'SET_ENABLED', isEnabled });
    };
    void checkEnabled();
    const interval = setInterval(checkEnabled, UI_TIMING.AUTH_CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      stopSyncServices();
    };
  }, [dispatch]);
}

async function updateCoordinatorStatus(dispatch: Dispatch<SyncAction>): Promise<void> {
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
}

function useCoordinatorStatus(dispatch: Dispatch<SyncAction>): void {
  useEffect(() => {
    const update = () => updateCoordinatorStatus(dispatch);
    void update();
    const interval = setInterval(update, UI_TIMING.STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dispatch]);
}

function useSyncHealthMonitoring(isEnabled: boolean): void {
  useEffect(() => {
    if (!isEnabled) return;
    let lastHealthCheckTime = 0;
    const checkHealth = async () => {
      const now = Date.now();
      if (now - lastHealthCheckTime < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS) return;
      lastHealthCheckTime = now;
      const report = await getHealthMonitor().check();
      for (const issue of report.issues) {
        logger.warn('Health issue detected', {
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
        });
      }
    };
    const timeout = setTimeout(checkHealth, UI_TIMING.INITIAL_HEALTH_CHECK_DELAY_MS);
    const interval = setInterval(checkHealth, SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isEnabled]);
}

function scheduleStatusReset(dispatch: Dispatch<SyncAction>, delay: number): void {
  setTimeout(() => dispatch({ type: 'SET_STATUS', status: 'idle' }), delay);
}

function dispatchSyncResult(dispatch: Dispatch<SyncAction>, result: PBSyncResult): void {
  if (result.status === 'success') {
    dispatch({ type: 'SYNC_SUCCESS', lastResult: result });
    scheduleStatusReset(dispatch, UI_TIMING.AUTO_RESET_SUCCESS_MS);
    return;
  }
  if (result.status === 'already_running') {
    dispatch({ type: 'SYNC_IDLE', lastResult: result });
    return;
  }
  dispatch({ type: 'SYNC_ERROR', error: result.error || 'Sync failed', lastResult: result });
  scheduleStatusReset(dispatch, UI_TIMING.AUTO_RESET_ERROR_MS);
}

async function runManualSync(dispatch: Dispatch<SyncAction>): Promise<PBSyncResult> {
  dispatch({ type: 'SYNC_START' });
  try {
    const coordinator = getSyncCoordinator();
    await coordinator.requestSync('user');
    const status = await coordinator.getStatus();
    const result = status.lastResult ?? {
      status: status.lastError ? 'error' as const : 'success' as const,
      ...(status.lastError ? { error: status.lastError } : {}),
    };
    dispatchSyncResult(dispatch, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    const result: PBSyncResult = { status: 'error', error: message };
    dispatchSyncResult(dispatch, result);
    return result;
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

  useSyncLifecycle(dispatch);
  useCoordinatorStatus(dispatch);
  useSyncHealthMonitoring(isEnabled);
  const sync = () => runManualSync(dispatch);

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
