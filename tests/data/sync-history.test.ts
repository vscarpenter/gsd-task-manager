/**
 * Tests for sync history tracking
 * Tests record creation, retrieval, filtering, cleanup, and statistics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import {
  recordSyncSuccess,
  recordSyncError,
  getRecentHistory,
  getHistoryForDevice,
  getHistoryStats,
  clearHistory,
} from '@/lib/sync-history';
import { createMockSyncHistoryRecord, mockConsole } from '../fixtures';

describe('sync-history', () => {
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    db = getDb();
    consoleMock = mockConsole();

    // Clear database
    await db.delete();
    await db.open();

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    consoleMock.restore();
    await db.delete();
  });

  describe('recordSyncSuccess', () => {
    it('should record successful sync with no conflicts', async () => {
      await recordSyncSuccess(5, 3, 0, 'device-123', 'user', 1500);

      const records = await db.syncHistory.toArray();
      expect(records).toHaveLength(1);
      
      const record = records[0];
      expect(record.status).toBe('success');
      expect(record.pushedCount).toBe(5);
      expect(record.pulledCount).toBe(3);
      expect(record.conflictsResolved).toBe(0);
      expect(record.deviceId).toBe('device-123');
      expect(record.triggeredBy).toBe('user');
      expect(record.duration).toBe(1500);
      expect(record.id).toBeDefined();
      expect(record.timestamp).toBeDefined();
    });

    it('should record sync with conflicts as conflict status', async () => {
      await recordSyncSuccess(2, 4, 3, 'device-456', 'auto', 2000);

      const records = await db.syncHistory.toArray();
      expect(records).toHaveLength(1);
      
      const record = records[0];
      expect(record.status).toBe('conflict');
      expect(record.conflictsResolved).toBe(3);
    });

    it('should record sync without duration', async () => {
      await recordSyncSuccess(1, 1, 0, 'device-789', 'user');

      const records = await db.syncHistory.toArray();
      expect(records).toHaveLength(1);
      
      const record = records[0];
      expect(record.duration).toBeUndefined();
    });

    it('should generate unique IDs for each record', async () => {
      await recordSyncSuccess(1, 0, 0, 'device-123', 'user');
      await recordSyncSuccess(0, 1, 0, 'device-123', 'auto');

      const records = await db.syncHistory.toArray();
      expect(records).toHaveLength(2);
      expect(records[0].id).not.toBe(records[1].id);
    });

    it('should record auto-triggered sync', async () => {
      await recordSyncSuccess(3, 2, 0, 'device-123', 'auto');

      const records = await db.syncHistory.toArray();
      const record = records[0];
      expect(record.triggeredBy).toBe('auto');
    });
  });

  describe('recordSyncError', () => {
    it('should record failed sync with error message', async () => {
      await recordSyncError('Network timeout', 'device-123', 'user', 500);

      const records = await db.syncHistory.toArray();
      expect(records).toHaveLength(1);
      
      const record = records[0];
      expect(record.status).toBe('error');
      expect(record.errorMessage).toBe('Network timeout');
      expect(record.pushedCount).toBe(0);
      expect(record.pulledCount).toBe(0);
      expect(record.conflictsResolved).toBe(0);
      expect(record.deviceId).toBe('device-123');
      expect(record.triggeredBy).toBe('user');
      expect(record.duration).toBe(500);
    });

    it('should record error without duration', async () => {
      await recordSyncError('Authentication failed', 'device-456', 'auto');

      const records = await db.syncHistory.toArray();
      const record = records[0];
      expect(record.errorMessage).toBe('Authentication failed');
      expect(record.duration).toBeUndefined();
    });
  });

  describe('getRecentHistory', () => {
    it('should return empty array when no history exists', async () => {
      const history = await getRecentHistory();
      expect(history).toEqual([]);
    });

    it('should return recent history in reverse chronological order', async () => {
      // Add records with different timestamps
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-1',
          timestamp: '2024-01-01T10:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-2',
          timestamp: '2024-01-01T11:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-3',
          timestamp: '2024-01-01T12:00:00Z',
        })
      );

      const history = await getRecentHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('sync-3'); // Most recent first
      expect(history[1].id).toBe('sync-2');
      expect(history[2].id).toBe('sync-1');
    });

    it('should limit results to specified count', async () => {
      // Add 10 records
      for (let i = 0; i < 10; i++) {
        await db.syncHistory.add(
          createMockSyncHistoryRecord({
            id: `sync-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          })
        );
      }

      const history = await getRecentHistory(5);
      expect(history).toHaveLength(5);
    });

    it('should default to 50 records limit', async () => {
      // Add 60 records
      for (let i = 0; i < 60; i++) {
        await db.syncHistory.add(
          createMockSyncHistoryRecord({
            id: `sync-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          })
        );
      }

      const history = await getRecentHistory();
      expect(history).toHaveLength(50);
    });

    it('should cap results at MAX_HISTORY_RECORDS (100)', async () => {
      // Add 120 records
      for (let i = 0; i < 120; i++) {
        await db.syncHistory.add(
          createMockSyncHistoryRecord({
            id: `sync-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          })
        );
      }

      const history = await getRecentHistory(150);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('getHistoryForDevice', () => {
    it('should return empty array when no history for device', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({ deviceId: 'device-123' })
      );

      const history = await getHistoryForDevice('device-456');
      expect(history).toEqual([]);
    });

    it('should return history only for specified device', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-1',
          deviceId: 'device-123',
          timestamp: '2024-01-01T10:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-2',
          deviceId: 'device-456',
          timestamp: '2024-01-01T11:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-3',
          deviceId: 'device-123',
          timestamp: '2024-01-01T12:00:00Z',
        })
      );

      const history = await getHistoryForDevice('device-123');
      
      expect(history).toHaveLength(2);
      expect(history.every(r => r.deviceId === 'device-123')).toBe(true);
    });

    it('should return device history in reverse chronological order', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-1',
          deviceId: 'device-123',
          timestamp: '2024-01-01T10:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-2',
          deviceId: 'device-123',
          timestamp: '2024-01-01T12:00:00Z',
        })
      );

      const history = await getHistoryForDevice('device-123');
      
      expect(history[0].id).toBe('sync-2'); // Most recent first
      expect(history[1].id).toBe('sync-1');
    });

    it('should limit device history to specified count', async () => {
      for (let i = 0; i < 10; i++) {
        await db.syncHistory.add(
          createMockSyncHistoryRecord({
            id: `sync-${i}`,
            deviceId: 'device-123',
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          })
        );
      }

      const history = await getHistoryForDevice('device-123', 3);
      expect(history).toHaveLength(3);
    });
  });

  describe('getHistoryStats', () => {
    it('should return zero stats when no history exists', async () => {
      const stats = await getHistoryStats();

      expect(stats).toEqual({
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        conflictSyncs: 0,
        totalPushed: 0,
        totalPulled: 0,
        totalConflictsResolved: 0,
        lastSyncAt: null,
      });
    });

    it('should calculate stats for successful syncs', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-1',
          status: 'success',
          pushedCount: 5,
          pulledCount: 3,
          conflictsResolved: 0,
          timestamp: '2024-01-01T10:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-2',
          status: 'success',
          pushedCount: 2,
          pulledCount: 4,
          conflictsResolved: 0,
          timestamp: '2024-01-01T11:00:00Z',
        })
      );

      const stats = await getHistoryStats();

      expect(stats.totalSyncs).toBe(2);
      expect(stats.successfulSyncs).toBe(2);
      expect(stats.failedSyncs).toBe(0);
      expect(stats.conflictSyncs).toBe(0);
      expect(stats.totalPushed).toBe(7);
      expect(stats.totalPulled).toBe(7);
      expect(stats.totalConflictsResolved).toBe(0);
      expect(stats.lastSyncAt).toBe('2024-01-01T11:00:00Z');
    });

    it('should calculate stats for failed syncs', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-1',
          status: 'error',
          errorMessage: 'Network error',
          timestamp: '2024-01-01T10:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-2',
          status: 'error',
          errorMessage: 'Auth error',
          timestamp: '2024-01-01T11:00:00Z',
        })
      );

      const stats = await getHistoryStats();

      expect(stats.totalSyncs).toBe(2);
      expect(stats.successfulSyncs).toBe(0);
      expect(stats.failedSyncs).toBe(2);
      expect(stats.conflictSyncs).toBe(0);
    });

    it('should calculate stats for conflict syncs', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          status: 'conflict',
          pushedCount: 3,
          pulledCount: 2,
          conflictsResolved: 5,
          timestamp: '2024-01-01T10:00:00Z',
        })
      );

      const stats = await getHistoryStats();

      expect(stats.totalSyncs).toBe(1);
      expect(stats.successfulSyncs).toBe(0);
      expect(stats.failedSyncs).toBe(0);
      expect(stats.conflictSyncs).toBe(1);
      expect(stats.totalConflictsResolved).toBe(5);
    });

    it('should calculate stats for mixed sync types', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-1',
          status: 'success',
          pushedCount: 10,
          pulledCount: 5,
          conflictsResolved: 0,
          timestamp: '2024-01-01T10:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-2',
          status: 'conflict',
          pushedCount: 3,
          pulledCount: 2,
          conflictsResolved: 4,
          timestamp: '2024-01-01T11:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-3',
          status: 'error',
          errorMessage: 'Network error',
          timestamp: '2024-01-01T12:00:00Z',
        })
      );

      const stats = await getHistoryStats();

      expect(stats.totalSyncs).toBe(3);
      expect(stats.successfulSyncs).toBe(1);
      expect(stats.failedSyncs).toBe(1);
      expect(stats.conflictSyncs).toBe(1);
      expect(stats.totalPushed).toBe(13);
      expect(stats.totalPulled).toBe(7);
      expect(stats.totalConflictsResolved).toBe(4);
      expect(stats.lastSyncAt).toBe('2024-01-01T12:00:00Z');
    });

    it('should identify most recent sync timestamp', async () => {
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-1',
          timestamp: '2024-01-01T10:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-2',
          timestamp: '2024-01-01T15:00:00Z',
        })
      );
      await db.syncHistory.add(
        createMockSyncHistoryRecord({
          id: 'sync-3',
          timestamp: '2024-01-01T12:00:00Z',
        })
      );

      const stats = await getHistoryStats();

      expect(stats.lastSyncAt).toBe('2024-01-01T15:00:00Z');
    });
  });

  describe('clearHistory', () => {
    it('should clear all sync history records', async () => {
      // Add multiple records
      await db.syncHistory.add(createMockSyncHistoryRecord({ id: 'sync-1' }));
      await db.syncHistory.add(createMockSyncHistoryRecord({ id: 'sync-2' }));
      await db.syncHistory.add(createMockSyncHistoryRecord({ id: 'sync-3' }));

      const beforeCount = await db.syncHistory.count();
      expect(beforeCount).toBe(3);

      await clearHistory();

      const afterCount = await db.syncHistory.count();
      expect(afterCount).toBe(0);
    });

    it('should not error when clearing empty history', async () => {
      await expect(clearHistory()).resolves.not.toThrow();
      
      const count = await db.syncHistory.count();
      expect(count).toBe(0);
    });
  });

  describe('cleanup old records', () => {
    it('should automatically cleanup when exceeding MAX_HISTORY_RECORDS', async () => {
      // Add 100 records (at the limit)
      for (let i = 0; i < 100; i++) {
        await db.syncHistory.add(
          createMockSyncHistoryRecord({
            id: `sync-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          })
        );
      }

      const countBefore = await db.syncHistory.count();
      expect(countBefore).toBe(100);

      // Add one more record, triggering cleanup
      await recordSyncSuccess(1, 1, 0, 'device-123', 'user');

      const countAfter = await db.syncHistory.count();
      expect(countAfter).toBe(100); // Should stay at 100
    });

    it('should keep most recent records during cleanup', async () => {
      // Add 100 records
      for (let i = 0; i < 100; i++) {
        await db.syncHistory.add(
          createMockSyncHistoryRecord({
            id: `sync-${i}`,
            timestamp: new Date(2024, 0, 1, 10, i).toISOString(),
          })
        );
      }

      // Add 5 more records to trigger cleanup
      for (let i = 100; i < 105; i++) {
        await recordSyncSuccess(1, 1, 0, 'device-123', 'user');
      }

      const records = await db.syncHistory.toArray();
      expect(records).toHaveLength(100);

      // Verify oldest records were removed
      const oldestId = records.reduce((oldest, record) => {
        return record.timestamp < oldest.timestamp ? record : oldest;
      });
      
      // The oldest remaining record should not be sync-0 through sync-4
      expect(oldestId.id).not.toMatch(/^sync-[0-4]$/);
    });

    it('should cleanup after recording error', async () => {
      // Add 100 records
      for (let i = 0; i < 100; i++) {
        await db.syncHistory.add(
          createMockSyncHistoryRecord({
            id: `sync-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          })
        );
      }

      // Add error record to trigger cleanup
      await recordSyncError('Test error', 'device-123', 'user');

      const count = await db.syncHistory.count();
      expect(count).toBe(100);
    });
  });
});
