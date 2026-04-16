/**
 * Sync notification handler
 * Provides user-friendly notifications for sync events and failures
 */

import { toast } from 'sonner';

export interface SyncNotificationOptions {
    enabled: boolean;
}


/**
 * Show notification for successful sync operations
 */
export function notifySyncSuccess(
    pushedCount: number,
    pulledCount: number,
    options: SyncNotificationOptions = { enabled: true }
): void {
    if (!options.enabled) return;

    const totalChanges = pushedCount + pulledCount;

    if (totalChanges === 0) {
        // Silent success - no changes
        return;
    }

    const messages: string[] = [];
    if (pushedCount > 0) {
        messages.push(`${pushedCount} ${pushedCount === 1 ? 'change' : 'changes'} uploaded`);
    }
    if (pulledCount > 0) {
        messages.push(`${pulledCount} ${pulledCount === 1 ? 'change' : 'changes'} downloaded`);
    }

    toast.success('Sync completed', {
        description: messages.join(', '),
        duration: 3000,
    });
}

/**
 * Show notification for sync failures
 */
export function notifySyncError(
    error: string,
    isPermanent: boolean = false,
    options: SyncNotificationOptions = { enabled: true }
): void {
    if (!options.enabled) return;

    if (isPermanent) {
        toast.error('Sync permanently failed', {
            description: error || 'Please check your connection and sign in again if needed.',
            duration: 10000,
        });
    } else {
        toast.error('Sync failed', {
            description: error || 'Will retry automatically.',
            duration: 5000,
        });
    }
}
