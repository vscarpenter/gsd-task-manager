/**
 * Sync notification handler
 * Provides user-friendly notifications for sync events and failures
 */

import { toast } from 'sonner';

export interface SyncNotificationOptions {
    enabled: boolean;
}

/**
 * Show notification for rejected sync operations
 */
export function notifyRejectedOperations(
    rejectedOps: Array<{ taskId: string; operation?: string; reason: string; details: string }>,
    options: SyncNotificationOptions = { enabled: true }
): void {
    if (!options.enabled || rejectedOps.length === 0) return;

    for (const rejected of rejectedOps) {
        const operationType = rejected.operation || 'operation';
        const action = getActionLabel(operationType);

        if (rejected.reason === 'validation_error') {
            toast.error(`Failed to ${action} task`, {
                description: rejected.details || 'The task data could not be validated.',
                duration: 5000,
            });
        } else {
            toast.error(`Failed to ${action} task`, {
                description: rejected.details || `The ${operationType} operation was rejected by the server.`,
                duration: 5000,
            });
        }
    }
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

/**
 * Get user-friendly action label for operation type
 */
function getActionLabel(operation: string): string {
    switch (operation) {
        case 'create':
            return 'create';
        case 'update':
            return 'update';
        case 'delete':
            return 'delete';
        default:
            return 'sync';
    }
}
