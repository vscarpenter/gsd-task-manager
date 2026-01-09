/**
 * Sync history management
 * Records and queries sync operation history
 */

import { getDb } from '@/lib/db';
import { generateId } from '@/lib/id-generator';
import type { SyncHistoryRecord } from '@/lib/types';
import { createLogger } from '@/lib/logger';
import { SYNC_CONFIG } from '@/lib/constants/sync';

const logger = createLogger('SYNC_HISTORY');

const MAX_HISTORY_RECORDS = 100; // Keep last 100 sync operations

/**
 * Record a successful sync operation
 */
export async function recordSyncSuccess(
  pushedCount: number,
  pulledCount: number,
  conflictsResolved: number,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  duration?: number
): Promise<void> {
  const db = getDb();

  const record: SyncHistoryRecord = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: conflictsResolved > 0 ? 'conflict' : 'success',
    pushedCount,
    pulledCount,
    conflictsResolved,
    deviceId,
    triggeredBy,
    duration,
  };

  await db.syncHistory.add(record);

  logger.info('Sync success recorded', {
    id: record.id,
    pushedCount,
    pulledCount,
    conflictsResolved,
    triggeredBy,
  });

  // Clean up old records if we exceed the limit
  await cleanupOldRecords();
}

/**
 * Record a failed sync operation
 */
export async function recordSyncError(
  errorMessage: string,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  duration?: number
): Promise<void> {
  const db = getDb();

  const record: SyncHistoryRecord = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: 'error',
    pushedCount: 0,
    pulledCount: 0,
    conflictsResolved: 0,
    errorMessage,
    deviceId,
    triggeredBy,
    duration,
  };

  await db.syncHistory.add(record);

  logger.warn('Sync error recorded', {
    id: record.id,
    errorMessage,
    triggeredBy,
  });

  // Clean up old records if we exceed the limit
  await cleanupOldRecords();
}

/**
 * Get recent sync history (limited to MAX_HISTORY_RECORDS)
 */
export async function getRecentHistory(limit: number = SYNC_CONFIG.DEFAULT_HISTORY_LIMIT): Promise<SyncHistoryRecord[]> {
  const db = getDb();

  const records = await db.syncHistory
    .orderBy('timestamp')
    .reverse()
    .limit(Math.min(limit, MAX_HISTORY_RECORDS))
    .toArray();

  return records;
}

/**
 * Get sync history for a specific device
 */
export async function getHistoryForDevice(deviceId: string, limit: number = SYNC_CONFIG.DEFAULT_HISTORY_LIMIT): Promise<SyncHistoryRecord[]> {
  const db = getDb();

  const records = await db.syncHistory
    .where('deviceId')
    .equals(deviceId)
    .reverse()
    .limit(limit)
    .toArray();

  return records;
}

/**
 * Get sync history statistics
 */
export async function getHistoryStats(): Promise<{
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictSyncs: number;
  totalPushed: number;
  totalPulled: number;
  totalConflictsResolved: number;
  lastSyncAt: string | null;
}> {
  const db = getDb();

  const allRecords = await db.syncHistory.toArray();

  const stats = {
    totalSyncs: allRecords.length,
    successfulSyncs: allRecords.filter(r => r.status === 'success').length,
    failedSyncs: allRecords.filter(r => r.status === 'error').length,
    conflictSyncs: allRecords.filter(r => r.status === 'conflict').length,
    totalPushed: allRecords.reduce((sum, r) => sum + r.pushedCount, 0),
    totalPulled: allRecords.reduce((sum, r) => sum + r.pulledCount, 0),
    totalConflictsResolved: allRecords.reduce((sum, r) => sum + r.conflictsResolved, 0),
    lastSyncAt: allRecords.length > 0
      ? allRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0].timestamp
      : null,
  };

  return stats;
}

/**
 * Clear all sync history
 */
export async function clearHistory(): Promise<void> {
  const db = getDb();
  await db.syncHistory.clear();
  logger.info('Sync history cleared');
}

/**
 * Clean up old records when we exceed MAX_HISTORY_RECORDS
 * Keeps only the most recent records
 */
async function cleanupOldRecords(): Promise<void> {
  const db = getDb();

  const count = await db.syncHistory.count();

  if (count > MAX_HISTORY_RECORDS) {
    const recordsToDelete = count - MAX_HISTORY_RECORDS;

    // Get oldest records
    const oldestRecords = await db.syncHistory
      .orderBy('timestamp')
      .limit(recordsToDelete)
      .toArray();

    // Delete them
    const idsToDelete = oldestRecords.map(r => r.id);
    await db.syncHistory.bulkDelete(idsToDelete);

    logger.debug('Cleaned up old sync history records', {
      deleted: recordsToDelete,
      remaining: MAX_HISTORY_RECORDS,
    });
  }
}
