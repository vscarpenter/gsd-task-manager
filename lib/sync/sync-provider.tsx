"use client";

import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getHealthMonitor } from '@/lib/sync/health-monitor';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { UI_TIMING } from '@/lib/constants/ui';
import { createLogger } from '@/lib/logger';
import type { PBSyncResult } from '@/lib/sync/types';
import {
  createSyncStatusStore,
  initialSyncStatus,
  type SyncStatusAction,
  type SyncStatusSnapshot,
} from '@/lib/sync/sync-status-store';

const logger = createLogger('SYNC_ENGINE');

export interface SyncState extends SyncStatusSnapshot {
  /** Trigger a manual sync. Returns the result directly (no stale closure). */
  sync: () => Promise<PBSyncResult>;
}

const SyncContext = createContext<SyncState | null>(null);

type Dispatch = (action: SyncStatusAction) => void;

function getInitialSyncStatus(): SyncStatusSnapshot {
  return initialSyncStatus;
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

function scheduleStatusReset(dispatch: Dispatch, delay: number): void {
  setTimeout(() => dispatch({ type: 'SET_STATUS', status: 'idle' }), delay);
}

function dispatchSyncResult(dispatch: Dispatch, result: PBSyncResult): void {
  if (result.status === 'success') {
    dispatch({ type: 'SYNC_SUCCESS', lastResult: result });
    scheduleStatusReset(dispatch, UI_TIMING.AUTO_RESET_SUCCESS_MS);
    return;
  }
  if (result.status === 'already_running' || result.status === 'cancelled') {
    dispatch({ type: 'SYNC_IDLE', lastResult: result });
    return;
  }
  dispatch({ type: 'SYNC_ERROR', error: result.error || 'Sync failed', lastResult: result });
  scheduleStatusReset(dispatch, UI_TIMING.AUTO_RESET_ERROR_MS);
}

async function runManualSync(dispatch: Dispatch): Promise<PBSyncResult> {
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
 * Mount once in ClientLayout. It creates the sync status store, starts it once,
 * and publishes its snapshot. This replaces the per-component lifecycle effects
 * that previously ran in every useSync() consumer, eliminating race conditions
 * from multiple background-sync starts and stops.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSyncStatusStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialSyncStatus);

  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  useSyncHealthMonitoring(state.isEnabled);
  const sync = () => runManualSync(store.dispatch);

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
