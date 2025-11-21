/**
 * Sync notification handler
 * Provides user-friendly notifications for sync events, conflicts, and failures
 */

import { toast } from 'sonner';

export interface SyncNotificationOptions {
    /**
     * Whether notifications are enabled
     */
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
        } else if (rejected.reason === 'version_mismatch') {
            toast.warning(`Task ${action} skipped`, {
                description: 'The task was modified on another device. Your changes were not applied.',
                duration: 6000,
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
 * Show notification for conflicted sync operations
 */
export function notifyConflicts(
    conflictedOps: Array<{
        taskId: string;
        operation?: string;
        reason: string;
    }>,
    options: SyncNotificationOptions = { enabled: true }
): void {
    if (!options.enabled || conflictedOps.length === 0) return;

    const deleteConflicts = conflictedOps.filter(c => c.operation === 'delete');
    const editConflicts = conflictedOps.filter(c => c.operation !== 'delete');

    // Handle delete conflicts specially
    for (const conflict of deleteConflicts) {
        if (conflict.reason === 'delete_edit') {
            toast.warning('Task delete prevented', {
                description: 'This task was modified on another device after you deleted it. The remote version has been restored.',
                duration: 7000,
            });
        } else if (conflict.reason === 'concurrent_edit') {
            toast.warning('Task delete conflict', {
                description: 'This task was being edited on multiple devices. The remote version takes precedence.',
                duration: 7000,
            });
        }
    }

    // Handle edit conflicts
    if (editConflicts.length === 1) {
        toast.warning('Task conflict detected', {
            description: 'This task was modified on another device. The remote version takes precedence.',
            duration: 6000,
        });
    } else if (editConflicts.length > 1) {
        toast.warning(`${editConflicts.length} task conflicts detected`, {
            description: 'These tasks were modified on other devices. Remote versions take precedence.',
            duration: 6000,
        });
    }
}

/**
 * Show notification for successful sync operations
 */
export function notifySyncSuccess(
    pushedCount: number,
    pulledCount: number,
    conflictsResolved: number,
    options: SyncNotificationOptions = { enabled: true }
): void {
    if (!options.enabled) return;

    // Only show success notification if there was significant activity
    const totalChanges = pushedCount + pulledCount + conflictsResolved;

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
    if (conflictsResolved > 0) {
        messages.push(`${conflictsResolved} ${conflictsResolved === 1 ? 'conflict' : 'conflicts'} resolved`);
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
