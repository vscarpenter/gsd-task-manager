/**
 * Cleanup handler for scheduled tasks
 * Removes soft-deleted tasks, old conflict logs, and inactive devices
 */

import type { Env } from '../types';
import { RETENTION } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('CLEANUP');

export interface CleanupResult {
    deletedTasks: number;
    conflictLogs: number;
    inactiveDevices: number;
    duration: number;
}

/**
 * Run all cleanup tasks
 */
export async function runCleanup(env: Env): Promise<CleanupResult> {
    const startTime = Date.now();

    logger.info('Starting scheduled cleanup tasks', {
        deletedTasksRetentionDays: RETENTION.DELETED_TASKS,
        conflictLogsRetentionDays: RETENTION.CONFLICT_LOGS,
        inactiveDevicesRetentionDays: RETENTION.INACTIVE_DEVICES,
    });

    const result: CleanupResult = {
        deletedTasks: 0,
        conflictLogs: 0,
        inactiveDevices: 0,
        duration: 0,
    };

    try {
        // Clean up soft-deleted tasks older than retention period
        result.deletedTasks = await cleanupDeletedTasks(env);

        // Clean up old conflict logs
        result.conflictLogs = await cleanupConflictLogs(env);

        // Clean up inactive devices
        result.inactiveDevices = await cleanupInactiveDevices(env);

        result.duration = Date.now() - startTime;

        logger.info('Cleanup tasks completed successfully', {
            deletedTasks: result.deletedTasks,
            conflictLogs: result.conflictLogs,
            inactiveDevices: result.inactiveDevices,
            duration: `${result.duration}ms`,
        });

        return result;
    } catch (error) {
        result.duration = Date.now() - startTime;
        logger.error('Cleanup tasks failed', error as Error, {
            partialResult: result,
            duration: `${result.duration}ms`,
        });
        throw error;
    }
}

/**
 * Clean up soft-deleted tasks older than retention period
 */
async function cleanupDeletedTasks(env: Env): Promise<number> {
    const thresholdMs = Date.now() - RETENTION.DELETED_TASKS * 24 * 60 * 60 * 1000;

    logger.info('Cleaning up soft-deleted tasks', {
        thresholdDate: new Date(thresholdMs).toISOString(),
        retentionDays: RETENTION.DELETED_TASKS,
    });

    try {
        // First, count how many tasks will be deleted
        const countResult = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM encrypted_tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?'
        )
            .bind(thresholdMs)
            .first();

        const count = (countResult?.count as number) || 0;

        if (count === 0) {
            logger.info('No soft-deleted tasks to clean up');
            return 0;
        }

        // Permanently delete the tasks
        await env.DB.prepare(
            'DELETE FROM encrypted_tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?'
        )
            .bind(thresholdMs)
            .run();

        logger.info('Soft-deleted tasks cleaned up', {
            deletedCount: count,
            thresholdDate: new Date(thresholdMs).toISOString(),
        });

        return count;
    } catch (error) {
        logger.error('Failed to clean up deleted tasks', error as Error, {
            threshold: thresholdMs,
        });
        throw error;
    }
}

/**
 * Clean up old conflict logs
 */
async function cleanupConflictLogs(env: Env): Promise<number> {
    const thresholdMs = Date.now() - RETENTION.CONFLICT_LOGS * 24 * 60 * 60 * 1000;

    logger.info('Cleaning up old conflict logs', {
        thresholdDate: new Date(thresholdMs).toISOString(),
        retentionDays: RETENTION.CONFLICT_LOGS,
    });

    try {
        const countResult = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM conflict_log WHERE resolved_at < ?'
        )
            .bind(thresholdMs)
            .first();

        const count = (countResult?.count as number) || 0;

        if (count === 0) {
            logger.info('No old conflict logs to clean up');
            return 0;
        }

        await env.DB.prepare('DELETE FROM conflict_log WHERE resolved_at < ?')
            .bind(thresholdMs)
            .run();

        logger.info('Old conflict logs cleaned up', {
            deletedCount: count,
            thresholdDate: new Date(thresholdMs).toISOString(),
        });

        return count;
    } catch (error) {
        logger.error('Failed to clean up conflict logs', error as Error, {
            threshold: thresholdMs,
        });
        throw error;
    }
}

/**
 * Clean up inactive devices
 */
async function cleanupInactiveDevices(env: Env): Promise<number> {
    const thresholdMs = Date.now() - RETENTION.INACTIVE_DEVICES * 24 * 60 * 60 * 1000;

    logger.info('Cleaning up inactive devices', {
        thresholdDate: new Date(thresholdMs).toISOString(),
        retentionDays: RETENTION.INACTIVE_DEVICES,
    });

    try {
        const countResult = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM devices WHERE last_seen_at < ? AND is_active = 0'
        )
            .bind(thresholdMs)
            .first();

        const count = (countResult?.count as number) || 0;

        if (count === 0) {
            logger.info('No inactive devices to clean up');
            return 0;
        }

        await env.DB.prepare('DELETE FROM devices WHERE last_seen_at < ? AND is_active = 0')
            .bind(thresholdMs)
            .run();

        logger.info('Inactive devices cleaned up', {
            deletedCount: count,
            thresholdDate: new Date(thresholdMs).toISOString(),
        });

        return count;
    } catch (error) {
        logger.error('Failed to clean up inactive devices', error as Error, {
            threshold: thresholdMs,
        });
        throw error;
    }
}
