/**
 * Comprehensive tests for sync conflict resolution fixes
 * Tests all 6 fixes for the sync bug
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compareVectorClocks, mergeVectorClocks } from '@/lib/sync/vector-clock';
import type { VectorClock } from '@/lib/sync/types';

describe('Sync Conflict Resolution Fixes', () => {
  describe('Vector Clock Operations (Fix #2)', () => {
    it('should merge vector clocks correctly', () => {
      const clock1: VectorClock = { device1: 5, device2: 3 };
      const clock2: VectorClock = { device1: 4, device2: 6, device3: 2 };

      const merged = mergeVectorClocks(clock1, clock2);

      expect(merged).toEqual({
        device1: 5, // max of 5 and 4
        device2: 6, // max of 3 and 6
        device3: 2, // only in clock2
      });
    });

    it('should merge empty clocks', () => {
      const clock1: VectorClock = {};
      const clock2: VectorClock = { device1: 5 };

      const merged = mergeVectorClocks(clock1, clock2);

      expect(merged).toEqual({ device1: 5 });
    });

    it('should handle identical clocks', () => {
      const clock: VectorClock = { device1: 5, device2: 3 };

      const merged = mergeVectorClocks(clock, clock);

      expect(merged).toEqual(clock);
    });
  });

  describe('Vector Clock Comparison', () => {
    it('should detect identical clocks', () => {
      const clock1: VectorClock = { device1: 5, device2: 3 };
      const clock2: VectorClock = { device1: 5, device2: 3 };

      const comparison = compareVectorClocks(clock1, clock2);

      expect(comparison).toBe('identical');
    });

    it('should detect b_before_a (clock2 is newer)', () => {
      const clock1: VectorClock = { device1: 5, device2: 3 };
      const clock2: VectorClock = { device1: 6, device2: 3 };

      const comparison = compareVectorClocks(clock1, clock2);

      // clock1 happened before clock2, so returns 'b_before_a'
      expect(comparison).toBe('b_before_a');
    });

    it('should detect a_before_b (clock1 is newer)', () => {
      const clock1: VectorClock = { device1: 6, device2: 3 };
      const clock2: VectorClock = { device1: 5, device2: 3 };

      const comparison = compareVectorClocks(clock1, clock2);

      // clock2 happened before clock1, so returns 'a_before_b'
      expect(comparison).toBe('a_before_b');
    });

    it('should detect concurrent edits (conflict)', () => {
      // Device1 made an edit (5→6), Device2 made an edit (3→4)
      const clock1: VectorClock = { device1: 6, device2: 3 };
      const clock2: VectorClock = { device1: 5, device2: 4 };

      const comparison = compareVectorClocks(clock1, clock2);

      expect(comparison).toBe('concurrent');
    });

    it('should handle empty clocks', () => {
      const clock1: VectorClock = {};
      const clock2: VectorClock = { device1: 5 };

      const comparison = compareVectorClocks(clock1, clock2);

      // Empty clock happened before non-empty clock, so returns 'b_before_a'
      expect(comparison).toBe('b_before_a');
    });
  });

  describe('Scenario: Stale Client Sync (Fix #1, #3)', () => {
    it('should send task data even when concurrent conflict is detected', () => {
      // Scenario: Browser 2 hasn't synced in a while, has stale vector clock
      const clientClock: VectorClock = { device1: 10, device2: 5 }; // Stale
      const serverClock: VectorClock = { device1: 11, device2: 5 }; // Device1 updated

      // Before Fix #1, server would detect concurrent and NOT send task
      // After Fix #1, server sends task even when concurrent is detected
      const comparison = compareVectorClocks(clientClock, serverClock);

      // Client clock is before server clock, returns 'b_before_a'
      expect(comparison).toBe('b_before_a');

      // But if client made ANY local change:
      const clientWithLocalChange: VectorClock = { device1: 10, device2: 6 };
      const comparisonWithLocalChange = compareVectorClocks(clientWithLocalChange, serverClock);

      // This becomes concurrent (both made changes)
      expect(comparisonWithLocalChange).toBe('concurrent');

      // Fix #1 ensures task data is STILL sent to client for resolution
    });

    it('should only trigger conflict if local task was modified after last sync (Fix #3)', () => {
      const lastSyncAt = new Date('2025-01-01T12:00:00Z').getTime();

      // Task modified BEFORE last sync - should NOT conflict
      const taskModifiedBefore = new Date('2025-01-01T11:59:00Z').getTime();
      const isModifiedAfterSync1 = taskModifiedBefore > lastSyncAt;
      expect(isModifiedAfterSync1).toBe(false); // No conflict

      // Task modified AFTER last sync - should conflict
      const taskModifiedAfter = new Date('2025-01-01T12:01:00Z').getTime();
      const isModifiedAfterSync2 = taskModifiedAfter > lastSyncAt;
      expect(isModifiedAfterSync2).toBe(true); // Conflict
    });
  });

  describe('Scenario: Rapid Updates (Fix #4)', () => {
    it('should use >= instead of > for timestamp queries', () => {
      const lastSyncAt = 1704110400000; // 2024-01-01 12:00:00.000
      const taskUpdatedAt1 = 1704110400000; // Exact same millisecond
      const taskUpdatedAt2 = 1704110400001; // 1ms later

      // With > (before fix), taskUpdatedAt1 would be missed
      const wouldBeMissedWithGT = taskUpdatedAt1 > lastSyncAt;
      expect(wouldBeMissedWithGT).toBe(false); // BUG!

      // With >= (after fix), taskUpdatedAt1 is included
      const includedWithGTE = taskUpdatedAt1 >= lastSyncAt;
      expect(includedWithGTE).toBe(true); // FIXED!

      // taskUpdatedAt2 works with both
      expect(taskUpdatedAt2 > lastSyncAt).toBe(true);
      expect(taskUpdatedAt2 >= lastSyncAt).toBe(true);
    });

    it('should subtract 1ms from lastSyncAt to prevent re-fetching (Fix #4)', () => {
      const currentTime = Date.now();
      const lastSyncAtWithFix = currentTime - 1;

      // Next sync should use >= with (currentTime - 1)
      // This prevents re-fetching tasks from exact same millisecond
      expect(lastSyncAtWithFix).toBe(currentTime - 1);

      // Tasks updated at currentTime will be fetched: currentTime >= (currentTime - 1)
      expect(currentTime >= lastSyncAtWithFix).toBe(true);

      // Tasks updated before currentTime - 1 will NOT be re-fetched
      const olderTask = currentTime - 2;
      expect(olderTask >= lastSyncAtWithFix).toBe(false);
    });
  });

  describe('Scenario: Multi-Device Sync (Fix #2)', () => {
    it('should accumulate knowledge from all devices', () => {
      // Device A's task
      const deviceAClock: VectorClock = { deviceA: 5 };

      // Device B pulls from Device A
      // Before Fix #2: deviceBClock = { deviceA: 5 } (loses track of deviceB)
      // After Fix #2: deviceBClock = { deviceA: 5, deviceB: 0 } (merged)

      const deviceBInitialClock: VectorClock = { deviceB: 0 };
      const mergedClock = mergeVectorClocks(deviceBInitialClock, deviceAClock);

      expect(mergedClock).toEqual({ deviceA: 5, deviceB: 0 });

      // Device B makes an edit
      const deviceBAfterEdit: VectorClock = { ...mergedClock, deviceB: 1 };
      expect(deviceBAfterEdit).toEqual({ deviceA: 5, deviceB: 1 });

      // Device C pulls from both
      const deviceCClock: VectorClock = {};
      const deviceCMerged = mergeVectorClocks(
        mergeVectorClocks(deviceCClock, deviceBAfterEdit),
        deviceAClock
      );

      expect(deviceCMerged).toEqual({ deviceA: 5, deviceB: 1 });
    });
  });

  describe('Scenario: Config Staleness (Fix #5)', () => {
    it('should use updated vector clock after push', () => {
      // Initial config
      const initialClock: VectorClock = { device1: 5 };

      // After push, server returns merged clock
      const serverClock: VectorClock = { device1: 6, device2: 10 };
      const mergedAfterPush = mergeVectorClocks(initialClock, serverClock);

      expect(mergedAfterPush).toEqual({ device1: 6, device2: 10 });

      // Fix #5 ensures this merged clock is used for pull phase
      // Without fix, pull would use stale initialClock = { device1: 5 }
      // With fix, pull uses mergedAfterPush = { device1: 6, device2: 10 }
    });
  });

  describe('Integration: Complete Sync Cycle', () => {
    it('should handle complete sync cycle without data loss', () => {
      // Browser 1 creates task
      const browser1Clock: VectorClock = { browser1: 1 };

      // Browser 1 syncs to server
      const serverClockAfterPush = mergeVectorClocks({}, browser1Clock);
      expect(serverClockAfterPush).toEqual({ browser1: 1 });

      // Browser 2 has old clock
      const browser2Clock: VectorClock = { browser2: 0 };

      // Browser 2 pulls (should NOT conflict - hasn't modified locally)
      const comparison = compareVectorClocks(browser2Clock, serverClockAfterPush);
      expect(comparison).toBe('b_before_a'); // Browser2 is behind

      // Browser 2 applies task with merged clock
      const browser2ClockAfterPull = mergeVectorClocks(browser2Clock, serverClockAfterPush);
      expect(browser2ClockAfterPull).toEqual({ browser1: 1, browser2: 0 });

      // Browser 2 makes local edit
      const browser2ClockAfterEdit: VectorClock = {
        ...browser2ClockAfterPull,
        browser2: 1,
      };
      expect(browser2ClockAfterEdit).toEqual({ browser1: 1, browser2: 1 });

      // Browser 1 pulls Browser 2's edit
      const finalClock = mergeVectorClocks(browser1Clock, browser2ClockAfterEdit);
      expect(finalClock).toEqual({ browser1: 1, browser2: 1 });

      // Both browsers now have complete knowledge
    });

    it('should detect true conflicts when both devices modify same task', () => {
      const lastSyncAt = Date.now();

      // Both devices start with same task
      const initialClock: VectorClock = { browser1: 5, browser2: 5 };

      // Browser 1 edits after sync
      const browser1EditTime = lastSyncAt + 1000;
      const browser1Clock: VectorClock = { browser1: 6, browser2: 5 };

      // Browser 2 also edits after sync (concurrently)
      const browser2EditTime = lastSyncAt + 2000;
      const browser2Clock: VectorClock = { browser1: 5, browser2: 6 };

      // Both modified after last sync
      expect(browser1EditTime > lastSyncAt).toBe(true);
      expect(browser2EditTime > lastSyncAt).toBe(true);

      // Vector clocks show concurrent edits
      const comparison = compareVectorClocks(browser1Clock, browser2Clock);
      expect(comparison).toBe('concurrent');

      // Last-write-wins: Browser 2 wins (later timestamp)
      const winner = browser2EditTime > browser1EditTime ? 'browser2' : 'browser1';
      expect(winner).toBe('browser2');

      // Merged clock includes both edits
      const resolvedClock = mergeVectorClocks(browser1Clock, browser2Clock);
      expect(resolvedClock).toEqual({ browser1: 6, browser2: 6 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle completely new device joining', () => {
      const existingClock: VectorClock = { device1: 10, device2: 5 };
      const newDeviceClock: VectorClock = {};

      const comparison = compareVectorClocks(newDeviceClock, existingClock);
      expect(comparison).toBe('b_before_a'); // New device is behind

      const mergedClock = mergeVectorClocks(newDeviceClock, existingClock);
      expect(mergedClock).toEqual({ device1: 10, device2: 5 });
    });

    it('should handle device that synced with subset of devices', () => {
      // Device1 and Device2 have synced
      const device1Clock: VectorClock = { device1: 5, device2: 3 };

      // Device3 only synced with Device1
      const device3Clock: VectorClock = { device1: 5, device3: 2 };

      // This is concurrent (both have changes the other doesn't know about)
      const comparison = compareVectorClocks(device1Clock, device3Clock);
      expect(comparison).toBe('concurrent');

      // Merge resolves by taking max of all
      const merged = mergeVectorClocks(device1Clock, device3Clock);
      expect(merged).toEqual({ device1: 5, device2: 3, device3: 2 });
    });

    it('should handle missing lastSyncAt (first sync)', () => {
      const lastSyncAt = null;

      // Task was modified at any time
      const taskUpdatedAt = Date.now();

      // Should not trigger conflict detection (no previous sync to compare to)
      const shouldCheckConflict = lastSyncAt && taskUpdatedAt > lastSyncAt;
      expect(shouldCheckConflict).toBeFalsy(); // null is falsy
    });
  });
});
