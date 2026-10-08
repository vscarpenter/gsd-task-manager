/**
 * Sync status store: the one owner of sync-status polling.
 *
 * SyncProvider creates one store, starts it once on mount, and reads it through
 * useSyncExternalStore. The store runs the enabled check every 2 s, the
 * coordinator status read every 500 ms while there is status to watch, and,
 * while sync is on, the queue's pending count every 2 s and a health check
 * 10 s after enable and then every 5 min. It also brings the realtime
 * subscription and the background-sync manager in line with the enabled flag.
 * Every poll runs through guardPoll, so a failed read is logged under
 * SYNC_STATUS and the snapshot keeps the value it last held.
 */

import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
import { getHealthMonitor, type HealthReport } from '@/lib/sync/health-monitor';
import { getSyncQueue } from '@/lib/sync/queue';
import { isAuthenticated } from '@/lib/sync/pocketbase-client';
import { SYNC_CONFIG } from '@/lib/constants/sync';
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
  /** Queue operations waiting to be pushed. Held at 0 while sync is off. */
  pendingCount: number;
  /** The latest health check report. Null while sync is off. */
  healthReport: HealthReport | null;
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
  pendingCount: 0,
  healthReport: null,
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
  | { type: 'SET_PENDING_COUNT'; pendingCount: number }
  | { type: 'SET_HEALTH_REPORT'; healthReport: HealthReport }
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
      // The pending count and the health report are only read while sync is
      // on, so switching off clears them rather than leaving the last values
      // on the badge and in the toasts.
      return mergeIfChanged(
        state,
        action.isEnabled
          ? { isEnabled: true }
          : { isEnabled: false, pendingCount: 0, healthReport: null }
      );
    case 'SET_PENDING_COUNT':
      return mergeIfChanged(state, { pendingCount: action.pendingCount });
    case 'SET_HEALTH_REPORT':
      return mergeIfChanged(state, { healthReport: action.healthReport });
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
  private countingPending = false;
  private checkingHealth = false;
  private enabledInterval: ReturnType<typeof setInterval> | null = null;
  private statusInterval: ReturnType<typeof setInterval> | null = null;
  private pendingInterval: ReturnType<typeof setInterval> | null = null;
  private healthTimeout: ReturnType<typeof setTimeout> | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;

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

  private readonly readPendingCount = guardPoll('pendingCount', async () => {
    const pendingCount = await getSyncQueue().getPendingCount();
    // A read that lands after sync switched off would put a stale count back
    // on a badge that is no longer shown.
    if (this.state.isEnabled) this.dispatch({ type: 'SET_PENDING_COUNT', pendingCount });
  });

  private readonly checkHealth = guardPoll('health', async () => {
    const healthReport = await getHealthMonitor().check();
    for (const issue of healthReport.issues) {
      logger.warn('Health issue detected', {
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
      });
    }
    if (this.state.isEnabled) this.dispatch({ type: 'SET_HEALTH_REPORT', healthReport });
  });

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
    if (!this.started) return;
    this.reconcileStatusPoll();
    this.reconcilePendingPoll();
    this.reconcileHealthPoll();
  };

  /** Run the enabled check now and every 2 s, and read the status once. */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.checkEnabled();
    this.enabledInterval = setInterval(this.checkEnabled, UI_TIMING.AUTH_CHECK_INTERVAL_MS);
    this.watching = hasStatusToWatch(this.state);
    this.armStatusPoll();
    this.countingPending = this.state.isEnabled;
    this.armPendingPoll();
    this.checkingHealth = this.state.isEnabled;
    this.armHealthPoll();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.enabledInterval) clearInterval(this.enabledInterval);
    this.enabledInterval = null;
    this.clearStatusPoll();
    this.clearPendingPoll();
    this.clearHealthPoll();
    stopSyncServices();
  }

  private reconcileHealthPoll(): void {
    const enabled = this.state.isEnabled;
    if (enabled === this.checkingHealth) return;
    this.checkingHealth = enabled;
    this.clearHealthPoll();
    this.armHealthPoll();
  }

  /**
   * The sync button's schedule, kept as the one schedule: a first check 10 s
   * after sync comes on, then one every 5 min, only while sync is on.
   */
  private armHealthPoll(): void {
    if (!this.checkingHealth) return;
    this.healthTimeout = setTimeout(this.checkHealth, SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);
    this.healthInterval = setInterval(this.checkHealth, SYNC_CONFIG.HEALTH_CHECK_INTERVAL_MS);
  }

  private clearHealthPoll(): void {
    if (this.healthTimeout) clearTimeout(this.healthTimeout);
    if (this.healthInterval) clearInterval(this.healthInterval);
    this.healthTimeout = null;
    this.healthInterval = null;
  }

  private reconcilePendingPoll(): void {
    const enabled = this.state.isEnabled;
    if (enabled === this.countingPending) return;
    this.countingPending = enabled;
    this.clearPendingPoll();
    this.armPendingPoll();
  }

  /** One read now, then every 2 s, only while sync is on. */
  private armPendingPoll(): void {
    if (!this.countingPending) return;
    void this.readPendingCount();
    this.pendingInterval = setInterval(
      this.readPendingCount,
      SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS
    );
  }

  private clearPendingPoll(): void {
    if (this.pendingInterval) clearInterval(this.pendingInterval);
    this.pendingInterval = null;
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
