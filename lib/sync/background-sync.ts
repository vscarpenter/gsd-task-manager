/**
 * Background Sync Manager
 *
 * Handles automatic background synchronization with smart triggers.
 * Also manages PocketBase realtime subscriptions alongside periodic sync.
 * Realtime SSE gives instant updates; periodic sync acts as a safety net.
 */

import { getSyncCoordinator } from './sync-coordinator';
import { getSyncQueue } from './queue';
import { subscribe as subscribeRealtime, unsubscribe as unsubscribeRealtime } from './pb-realtime';
import type { BackgroundSyncConfig } from './types';
import { createLogger } from '@/lib/logger';
import { SYNC_CONFIG } from '@/lib/constants/sync';

const logger = createLogger('SYNC_ENGINE');

export class BackgroundSyncManager {
    private syncInterval: NodeJS.Timeout | null = null;
    private isActive = false;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private lastSyncTimestamp = 0;
    private readonly MIN_SYNC_INTERVAL_MS = 15000;

    private visibilityChangeHandler: (() => void) | null = null;
    private onlineHandler: (() => void) | null = null;
    private config: BackgroundSyncConfig | null = null;

    /**
     * Start background sync and realtime subscription
     */
    async start(config: BackgroundSyncConfig, deviceId?: string): Promise<void> {
        if (this.isActive) {
            logger.warn('Background sync already running, stopping previous instance');
            this.stop();
        }

        this.config = config;
        this.isActive = true;

        logger.info('Starting background sync', {
            enabled: config.enabled,
            intervalMinutes: config.intervalMinutes,
        });

        if (!config.enabled) {
            logger.debug('Auto-sync disabled in config, not starting');
            return;
        }

        // Start PocketBase realtime subscription for instant updates
        if (deviceId) {
            try {
                await subscribeRealtime(deviceId);
            } catch (error) {
                logger.warn('Failed to start realtime subscription, falling back to polling', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        this.startPeriodicSync(config.intervalMinutes);

        if (config.syncOnFocus) {
            this.setupVisibilityListener();
        }

        if (config.syncOnOnline) {
            this.setupOnlineListener();
        }

        // Perform initial sync after a short delay
        setTimeout(() => {
            if (this.isActive) {
                this.performSyncIfNeeded('initial');
            }
        }, SYNC_CONFIG.INITIAL_SYNC_DELAY_MS);
    }

    /**
     * Stop all background sync activities and realtime subscription
     */
    stop(): void {
        if (!this.isActive) return;

        logger.debug('Stopping background sync');

        this.isActive = false;
        this.config = null;

        // Stop realtime subscription
        unsubscribeRealtime();

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }

        if (this.visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
            this.visibilityChangeHandler = null;
        }

        if (this.onlineHandler) {
            window.removeEventListener('online', this.onlineHandler);
            this.onlineHandler = null;
        }

        logger.debug('Background sync stopped and cleaned up');
    }

    isRunning(): boolean {
        return this.isActive;
    }

    /**
     * Schedule debounced sync after task changes
     */
    scheduleDebouncedSync(): void {
        if (!this.isActive || !this.config) return;

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        const delayMs = this.config.debounceAfterChangeMs;
        logger.debug('Scheduling debounced sync', { delayMs });

        this.debounceTimeout = setTimeout(() => {
            if (this.isActive) {
                this.performSyncIfNeeded('debounced');
            }
            this.debounceTimeout = null;
        }, delayMs);
    }

    private startPeriodicSync(intervalMinutes: number): void {
        const intervalMs = intervalMinutes * 60 * 1000;
        this.syncInterval = setInterval(() => {
            if (this.isActive) {
                this.performSyncIfNeeded('periodic');
            }
        }, intervalMs);
    }

    private setupVisibilityListener(): void {
        this.visibilityChangeHandler = () => {
            if (document.visibilityState === 'visible' && this.isActive) {
                logger.debug('Tab became visible, triggering sync');
                this.performSyncIfNeeded('visibility');
            }
        };
        document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    private setupOnlineListener(): void {
        this.onlineHandler = () => {
            if (this.isActive) {
                logger.debug('Network reconnected, triggering sync');
                this.performSyncIfNeeded('online');
            }
        };
        window.addEventListener('online', this.onlineHandler);
    }

    private async performSyncIfNeeded(
        trigger: 'initial' | 'periodic' | 'debounced' | 'visibility' | 'online'
    ): Promise<void> {
        if (!navigator.onLine) {
            logger.debug('Skipping sync: offline', { trigger });
            return;
        }

        const now = Date.now();
        if (now - this.lastSyncTimestamp < this.MIN_SYNC_INTERVAL_MS) {
            logger.debug('Skipping sync: too soon since last sync', { trigger });
            return;
        }

        try {
            const queue = getSyncQueue();
            const pendingCount = await queue.getPendingCount();

            logger.info('Triggering background sync', { trigger, pendingCount });
            this.lastSyncTimestamp = now;

            const coordinator = getSyncCoordinator();
            await coordinator.requestSync('auto');
        } catch (error) {
            logger.error('Error during background sync', error instanceof Error ? error : undefined, { trigger });
        }
    }
}

// Singleton instance
let managerInstance: BackgroundSyncManager | null = null;

export function getBackgroundSyncManager(): BackgroundSyncManager {
    if (!managerInstance) {
        managerInstance = new BackgroundSyncManager();
    }
    return managerInstance;
}
