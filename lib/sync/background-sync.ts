/**
 * Background Sync Manager
 * Handles automatic background synchronization with smart triggers
 */

import { getSyncCoordinator } from './sync-coordinator';
import { getSyncQueue } from './queue';
import type { BackgroundSyncConfig } from './types';

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
            console.warn('[BACKGROUND SYNC] Already running, stopping previous instance');
            this.stop();
        }

        this.config = config;
        this.isActive = true;

        console.log('[BACKGROUND SYNC] Starting with config:', {
            enabled: config.enabled,
            intervalMinutes: config.intervalMinutes,
            syncOnFocus: config.syncOnFocus,
            syncOnOnline: config.syncOnOnline,
        });

        if (!config.enabled) {
            console.log('[BACKGROUND SYNC] Auto-sync disabled in config, not starting');
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

        // Perform initial sync after a short delay (10 seconds)
        setTimeout(() => {
            if (this.isActive) {
                this.performSyncIfNeeded('initial');
            }
        }, 10000);
    }

    /**
     * Stop all background sync activities
     * Cleans up intervals and event listeners
     */
    stop(): void {
        if (!this.isActive) {
            return;
        }

        console.log('[BACKGROUND SYNC] Stopping');

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

        console.log('[BACKGROUND SYNC] Stopped and cleaned up');
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

        console.log(`[BACKGROUND SYNC] Scheduling debounced sync in ${delayMs}ms`);

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

        console.log(`[BACKGROUND SYNC] Setting up periodic sync every ${intervalMinutes} minute(s)`);

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
                console.log('[BACKGROUND SYNC] Tab became visible, triggering sync');
                this.performSyncIfNeeded('visibility');
            }
        };

        document.addEventListener('visibilitychange', this.visibilityChangeHandler);
        console.log('[BACKGROUND SYNC] Visibility change listener registered');
    }

    /**
     * Set up online event listener
     * Syncs when network reconnects
     */
    private setupOnlineListener(): void {
        this.onlineHandler = () => {
            if (this.isActive) {
                console.log('[BACKGROUND SYNC] Network reconnected, triggering sync');
                this.performSyncIfNeeded('online');
            }
        };

        window.addEventListener('online', this.onlineHandler);
        console.log('[BACKGROUND SYNC] Online event listener registered');
    }

    /**
     * Perform sync if conditions are met
     * Checks: online status, pending changes, minimum interval
     */
    private async performSyncIfNeeded(trigger: 'initial' | 'periodic' | 'debounced' | 'visibility' | 'online'): Promise<void> {
        // Check if online
        if (!navigator.onLine) {
            console.log(`[BACKGROUND SYNC] Skipping (${trigger}): offline`);
            return;
        }

        // Check if enough time has passed since last sync
        const now = Date.now();
        const timeSinceLastSync = now - this.lastSyncTimestamp;

        if (timeSinceLastSync < this.MIN_SYNC_INTERVAL_MS) {
            console.log(`[BACKGROUND SYNC] Skipping (${trigger}): too soon since last sync (${Math.round(timeSinceLastSync / 1000)}s ago)`);
            return;
        }

        // Check if there are pending changes
        try {
            const queue = getSyncQueue();
            const pendingCount = await queue.getPendingCount();

            if (pendingCount === 0) {
                console.log(`[BACKGROUND SYNC] Skipping (${trigger}): no pending changes`);
                return;
            }

            // All conditions met, perform sync
            console.log(`[BACKGROUND SYNC] Triggering sync (${trigger}): ${pendingCount} pending changes`);

            this.lastSyncTimestamp = now;

            const coordinator = getSyncCoordinator();
            await coordinator.requestSync('auto');

            console.log(`[BACKGROUND SYNC] Sync completed (${trigger})`);
        } catch (error) {
            console.error(`[BACKGROUND SYNC] Error during sync (${trigger}):`, error);
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
