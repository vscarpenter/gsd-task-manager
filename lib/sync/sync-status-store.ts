/**
 * Sync status store: the one owner of sync-status polling.
 *
 * SyncProvider creates one store, starts it once on mount, and reads it through
 * useSyncExternalStore. The store runs the enabled check every 2 s and the
 * coordinator status read every 500 ms while there is status to watch, and it
 * brings the realtime subscription and the background-sync manager in line
 * with the enabled flag. Every poll runs through guardPoll, so a failed read is
 * logged under SYNC_STATUS and the snapshot keeps the value it last held.
 */

import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
import { isAuthenticated } from '@/lib/sync/pocketbase-client';
import { UI_TIMING } from '@/lib/constants/ui';
import { createLogger } from '@/lib/logger';
import type { PBSyncResult, PBSyncConfig } from '@/lib/sync/types';
import { getDb } from '@/lib/db';
import { subscribe, unsubscribe } from '@/lib/sync/pb-realtime';
import { guardPoll } from '@/lib/sync/sync-status-poll';

const logger = createLogger('SYNC_ENGINE');

/** The readable sync status that SyncProvider publishes to every consumer. */
export interface SyncStatusSnapshot {
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

export const initialSyncStatus: SyncStatusSnapshot = {
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

export type SyncStatusAction =
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
  | { type: 'SET_STATUS'; status: SyncStatusSnapshot['status'] }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_SUCCESS'; lastResult: PBSyncResult }
  | { type: 'SYNC_IDLE'; lastResult: PBSyncResult }
  | { type: 'SYNC_ERROR'; error: string; lastResult: PBSyncResult };

/**
 * The polls dispatch on every tick, mostly with values the snapshot already
 * holds. Returning the same reference is what lets useSyncExternalStore skip
 * the render, so a poll that changes nothing re-renders no useSync() consumer.
 */
function mergeIfChanged(
  state: SyncStatusSnapshot,
  patch: Partial<SyncStatusSnapshot>
): SyncStatusSnapshot {
  const keys = Object.keys(patch) as Array<keyof SyncStatusSnapshot>;
  return keys.some((key) => state[key] !== patch[key]) ? { ...state, ...patch } : state;
}

/** The actions the polls dispatch. Returns null for the manual-sync actions. */
function reducePollAction(
  state: SyncStatusSnapshot,
  action: SyncStatusAction
): SyncStatusSnapshot | null {
  switch (action.type) {
    case 'SET_ENABLED':
      return mergeIfChanged(state, { isEnabled: action.isEnabled });
    case 'SET_COORDINATOR_STATUS':
      return mergeIfChanged(state, {
        isSyncing: action.isSyncing,
        pendingRequests: action.pendingRequests,
        nextRetryAt: action.nextRetryAt,
        retryCount: action.retryCount,
        lastSuccessfulSyncAt: action.lastSuccessfulSyncAt,
      });
    case 'SET_AUTO_SYNC':
      return mergeIfChanged(state, {
        autoSyncEnabled: action.autoSyncEnabled,
        autoSyncInterval: action.autoSyncInterval,
      });
    case 'SET_LAST_RESULT':
      return mergeIfChanged(state, { lastResult: action.lastResult });
    case 'SET_ERROR':
      return mergeIfChanged(state, { error: action.error });
    default:
      return null;
  }
}

/** The actions a manual sync dispatches. Each one always yields a new snapshot. */
function reduceManualSyncAction(
  state: SyncStatusSnapshot,
  action: SyncStatusAction
): SyncStatusSnapshot {
  switch (action.type) {
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

function syncStatusReducer(
  state: SyncStatusSnapshot,
  action: SyncStatusAction
): SyncStatusSnapshot {
  return reducePollAction(state, action) ?? reduceManualSyncAction(state, action);
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

/**
 * Read whether sync is on. Cheap and local: an auth-store check plus one
 * IndexedDB read, with no network in the path.
 */
async function readSyncEnabled(): Promise<{
  enabled: boolean;
  config?: PBSyncConfig;
}> {
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined;
  return { enabled: isAuthenticated() && Boolean(config?.enabled), config };
}

/**
 * Bring the sync services in line with `enabled`. Kept separate from reading
 * that flag because these are network round trips (the realtime handshake and
 * subscription POST, then the background-sync start) and the UI must not wait
 * on them to learn a value it already has. See the caller.
 */
async function applySyncServices(
  enabled: boolean,
  config?: PBSyncConfig
): Promise<void> {
  await reconcileRealtime(enabled, config?.deviceId);
  await reconcileBackgroundSync(enabled, config?.deviceId);
}

function stopSyncServices(): void {
  const backgroundSync = getBackgroundSyncManager();
  if (backgroundSync.isRunning()) backgroundSync.stop();
  unsubscribe();
}

async function readCoordinatorStatus(dispatch: (action: SyncStatusAction) => void): Promise<void> {
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

/**
 * Signing out does not stop a sync that is already running, so work in flight
 * is watched to its end. The sync button is disabled while isSyncing is true
 * and it is the only way back to the sign-in dialog. A status that stopped
 * updating mid-sync would leave it locked until a reload.
 */
function hasStatusToWatch(state: SyncStatusSnapshot): boolean {
  return state.isEnabled || state.isSyncing || state.pendingRequests > 0;
}

export class SyncStatusStore {
  private state = initialSyncStatus;
  private readonly listeners = new Set<() => void>();
  private started = false;
  private watching = false;
  private enabledInterval: ReturnType<typeof setInterval> | null = null;
  private statusInterval: ReturnType<typeof setInterval> | null = null;

  private readonly checkEnabled = guardPoll('enabled', async () => {
    const { enabled, config } = await readSyncEnabled();
    // Publish before the services are reconciled. Holding this back until the
    // realtime socket settles renders an authenticated user as signed out for
    // the length of a network round trip, and the sync button offers them a
    // re-login they do not need.
    this.dispatch({ type: 'SET_ENABLED', isEnabled: enabled });
    await applySyncServices(enabled, config);
  });

  private readonly readStatus = guardPoll('coordinator', () => readCoordinatorStatus(this.dispatch));

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SyncStatusSnapshot => this.state;

  dispatch = (action: SyncStatusAction): void => {
    const next = syncStatusReducer(this.state, action);
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
    if (this.started) this.reconcileStatusPoll();
  };

  /** Run the enabled check now and every 2 s, and read the status once. */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.checkEnabled();
    this.enabledInterval = setInterval(this.checkEnabled, UI_TIMING.AUTH_CHECK_INTERVAL_MS);
    this.watching = hasStatusToWatch(this.state);
    this.armStatusPoll();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.enabledInterval) clearInterval(this.enabledInterval);
    this.enabledInterval = null;
    this.clearStatusPoll();
    stopSyncServices();
  }

  private reconcileStatusPoll(): void {
    const watch = hasStatusToWatch(this.state);
    if (watch === this.watching) return;
    this.watching = watch;
    this.clearStatusPoll();
    this.armStatusPoll();
  }

  /**
   * Coordinator status only changes while sync has work to report, so the
   * 500 ms poll runs only then. Each tick costs three IndexedDB reads, and the
   * provider mounts on every route. One read still happens on start and on
   * every switch, which publishes the last sync time at boot.
   */
  private armStatusPoll(): void {
    void this.readStatus();
    if (!this.watching) return;
    this.statusInterval = setInterval(this.readStatus, UI_TIMING.STATUS_POLL_INTERVAL_MS);
  }

  private clearStatusPoll(): void {
    if (this.statusInterval) clearInterval(this.statusInterval);
    this.statusInterval = null;
  }
}

export function createSyncStatusStore(): SyncStatusStore {
  return new SyncStatusStore();
}
