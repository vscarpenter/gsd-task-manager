/**
 * Background Sync Manager
 * Handles automatic background synchronization with smart triggers
 */

import { getSyncCoordinator } from './sync-coordinator';
import { getSyncQueue } from './queue';
import type { BackgroundSyncConfig } from './types';
import { createLogger } from '@/lib/logger';
import { SYNC_CONFIG } from '@/lib/constants/sync';

const logger = createLogger('SYNC_ENGINE');

export class BackgroundSyncManager {
    // Interval-based periodic sync
    private syncInterval: NodeJS.Timeout | null = null;
    private isActive = false;

    // Debounced sync after changes
    private debounceTimeout: NodeJS.Timeout | null = null;

    // Prevents excessive syncing
    private lastSyncTimestamp = 0;
    private readonly MIN_SYNC_INTERVAL_MS = 15000; // 15 seconds minimum between syncs

    // Event listeners for cleanup
    private visibilityChangeHandler: (() => void) | null = null;
    private onlineHandler: (() => void) | null = null;

    // Current configuration
    private config: BackgroundSyncConfig | null = null;

    /**
     * Start background sync with configurable settings
     * Sets up periodic sync, visibility change listener, and online event listener
     */
    async start(config: BackgroundSyncConfig): Promise<void> {
        if (this.isActive) {
            logger.warn('Background sync already running, stopping previous instance');
            this.stop();
        }

        this.config = config;
        this.isActive = true;

        logger.info('Starting background sync', {
            enabled: config.enabled,
            intervalMinutes: config.intervalMinutes,
            syncOnFocus: config.syncOnFocus,
            syncOnOnline: config.syncOnOnline,
        });

        if (!config.enabled) {
            logger.debug('Auto-sync disabled in config, not starting');
            return;
        }

        // Start periodic sync
        this.startPeriodicSync(config.intervalMinutes);

        // Set up visibility change listener (sync when tab becomes visible)
        if (config.syncOnFocus) {
            this.setupVisibilityListener();
        }

        // Set up online event listener (sync when network reconnects)
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
     * Stop all background sync activities
     * Cleans up intervals and event listeners
     */
    stop(): void {
        if (!this.isActive) {
            return;
        }

        logger.debug('Stopping background sync');

        this.isActive = false;
        this.config = null;

        // Clear periodic sync interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Clear debounce timeout
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }

        // Remove event listeners
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

    /**
     * Check if background sync is currently running
     */
    isRunning(): boolean {
        return this.isActive;
    }

    /**
     * Schedule debounced sync after task changes
     * Cancels previous timeout and sets new one
     */
    scheduleDebouncedSync(): void {
        if (!this.isActive || !this.config) {
            return;
        }

        // Cancel existing timeout
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

    /**
     * Start periodic sync interval
     */
    private startPeriodicSync(intervalMinutes: number): void {
        const intervalMs = intervalMinutes * 60 * 1000;

        logger.debug('Setting up periodic sync', { intervalMinutes, intervalMs });

        this.syncInterval = setInterval(() => {
            if (this.isActive) {
                this.performSyncIfNeeded('periodic');
            }
        }, intervalMs);
    }

    /**
     * Set up visibility change listener
     * Syncs when tab becomes visible after being hidden
     */
    private setupVisibilityListener(): void {
        this.visibilityChangeHandler = () => {
            if (document.visibilityState === 'visible' && this.isActive) {
                logger.debug('Tab became visible, triggering sync');
                this.performSyncIfNeeded('visibility');
            }
        };

        document.addEventListener('visibilitychange', this.visibilityChangeHandler);
        logger.debug('Visibility change listener registered');
    }

    /**
     * Set up online event listener
     * Syncs when network reconnects
     */
    private setupOnlineListener(): void {
        this.onlineHandler = () => {
            if (this.isActive) {
                logger.debug('Network reconnected, triggering sync');
                this.performSyncIfNeeded('online');
            }
        };

        window.addEventListener('online', this.onlineHandler);
        logger.debug('Online event listener registered');
    }

    /**
     * Perform sync if conditions are met
     * Checks: online status, pending changes, minimum interval
     */
    private async performSyncIfNeeded(trigger: 'initial' | 'periodic' | 'debounced' | 'visibility' | 'online'): Promise<void> {
        // Check if online
        if (!navigator.onLine) {
            logger.debug('Skipping sync: offline', { trigger });
            return;
        }

        // Check if enough time has passed since last sync
        const now = Date.now();
        const timeSinceLastSync = now - this.lastSyncTimestamp;

        if (timeSinceLastSync < this.MIN_SYNC_INTERVAL_MS) {
            logger.debug('Skipping sync: too soon since last sync', {
                trigger,
                timeSinceLastSyncSec: Math.round(timeSinceLastSync / 1000)
            });
            return;
        }

        // Check if there are pending changes
        try {
            const queue = getSyncQueue();
            const pendingCount = await queue.getPendingCount();

            if (pendingCount === 0) {
                logger.debug('Skipping sync: no pending changes', { trigger });
                return;
            }

            // All conditions met, perform sync
            logger.info('Triggering background sync', { trigger, pendingCount });

            this.lastSyncTimestamp = now;

            const coordinator = getSyncCoordinator();
            await coordinator.requestSync('auto');

            logger.debug('Background sync completed', { trigger });
        } catch (error) {
            logger.error('Error during background sync', error instanceof Error ? error : undefined, { trigger });
        }
    }
}

// Singleton instance
let managerInstance: BackgroundSyncManager | null = null;

/**
 * Get or create background sync manager instance
 */
export function getBackgroundSyncManager(): BackgroundSyncManager {
    if (!managerInstance) {
        managerInstance = new BackgroundSyncManager();
    }
    return managerInstance;
}
