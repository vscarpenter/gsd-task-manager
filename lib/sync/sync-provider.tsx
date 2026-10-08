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
import { UI_TIMING } from '@/lib/constants/ui';
import type { PBSyncResult } from '@/lib/sync/types';
import {
  createSyncStatusStore,
  initialSyncStatus,
  type SyncStatusAction,
  type SyncStatusSnapshot,
} from '@/lib/sync/sync-status-store';

export interface SyncState extends SyncStatusSnapshot {
  /** Trigger a manual sync. Returns the result directly (no stale closure). */
  sync: () => Promise<PBSyncResult>;
}

const SyncContext = createContext<SyncState | null>(null);

type Dispatch = (action: SyncStatusAction) => void;

function getInitialSyncStatus(): SyncStatusSnapshot {
  return initialSyncStatus;
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
