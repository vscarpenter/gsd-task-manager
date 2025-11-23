import { describe, it, expect } from 'vitest';
import {
  compareVectorClocks,
  mergeVectorClocks,
  incrementVectorClock,
  happensBefore,
  areConcurrent,
  createVectorClock,
  cloneVectorClock,
} from '@/lib/sync/vector-clock';
import type { VectorClock } from '@/lib/sync/types';

describe('Vector Clock Operations', () => {
  describe('createVectorClock', () => {
    it('should create initial clock with device counter at 1', () => {
      const clock = createVectorClock('device-a');
      expect(clock).toEqual({ 'device-a': 1 });
    });

    it('should handle different device IDs', () => {
      const clock1 = createVectorClock('laptop');
      const clock2 = createVectorClock('phone');

      expect(clock1).toEqual({ laptop: 1 });
      expect(clock2).toEqual({ phone: 1 });
    });
  });

  describe('incrementVectorClock', () => {
    it('should increment existing device counter', () => {
      const clock: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const incremented = incrementVectorClock(clock, 'device-a');

      expect(incremented).toEqual({ 'device-a': 4, 'device-b': 2 });
      // Should not mutate original
      expect(clock).toEqual({ 'device-a': 3, 'device-b': 2 });
    });

    it('should add new device with counter 1', () => {
      const clock: VectorClock = { 'device-a': 3 };
      const incremented = incrementVectorClock(clock, 'device-b');

      expect(incremented).toEqual({ 'device-a': 3, 'device-b': 1 });
    });

    it('should handle empty clock', () => {
      const clock: VectorClock = {};
      const incremented = incrementVectorClock(clock, 'device-a');

      expect(incremented).toEqual({ 'device-a': 1 });
    });

    it('should increment from zero if device exists with 0', () => {
      const clock: VectorClock = { 'device-a': 0 };
      const incremented = incrementVectorClock(clock, 'device-a');

      expect(incremented).toEqual({ 'device-a': 1 });
    });
  });

  describe('compareVectorClocks', () => {
    it('should return "identical" for same clocks', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const clockB: VectorClock = { 'device-a': 3, 'device-b': 2 };

      expect(compareVectorClocks(clockA, clockB)).toBe('identical');
    });

    it('should return "identical" for empty clocks', () => {
      const clockA: VectorClock = {};
      const clockB: VectorClock = {};

      expect(compareVectorClocks(clockA, clockB)).toBe('identical');
    });

    it('should return "b_before_a" when A happened before B (B has larger counters)', () => {
      const clockA: VectorClock = { 'device-a': 2, 'device-b': 1 };
      const clockB: VectorClock = { 'device-a': 3, 'device-b': 2 };

      expect(compareVectorClocks(clockA, clockB)).toBe('b_before_a');
    });

    it('should return "a_before_b" when B happened before A (A has larger counters)', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const clockB: VectorClock = { 'device-a': 2, 'device-b': 1 };

      expect(compareVectorClocks(clockA, clockB)).toBe('a_before_b');
    });

    it('should return "concurrent" for conflicting clocks', () => {
      // Device A has higher counter on device-a, B has higher on device-b
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 1 };
      const clockB: VectorClock = { 'device-a': 2, 'device-b': 5 };

      expect(compareVectorClocks(clockA, clockB)).toBe('concurrent');
    });

    it('should handle missing devices (treat as 0)', () => {
      const clockA: VectorClock = { 'device-a': 3 };
      const clockB: VectorClock = { 'device-b': 2 };

      // A has device-a:3, B has device-a:0 → A greater
      // B has device-b:2, A has device-b:0 → B greater
      // Therefore concurrent
      expect(compareVectorClocks(clockA, clockB)).toBe('concurrent');
    });

    it('should return "b_before_a" when A is subset of B', () => {
      const clockA: VectorClock = { 'device-a': 2 };
      const clockB: VectorClock = { 'device-a': 3, 'device-b': 1 };

      expect(compareVectorClocks(clockA, clockB)).toBe('b_before_a');
    });

    it('should return "a_before_b" when B is subset of A', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 1 };
      const clockB: VectorClock = { 'device-a': 2 };

      expect(compareVectorClocks(clockA, clockB)).toBe('a_before_b');
    });

    it('should handle many devices correctly', () => {
      const clockA: VectorClock = { a: 1, b: 2, c: 3, d: 4 };
      const clockB: VectorClock = { a: 2, b: 3, c: 4, d: 5 };

      expect(compareVectorClocks(clockA, clockB)).toBe('b_before_a');
    });

    it('should detect concurrent with many devices', () => {
      const clockA: VectorClock = { a: 5, b: 2, c: 3 };
      const clockB: VectorClock = { a: 3, b: 6, c: 2 };

      expect(compareVectorClocks(clockA, clockB)).toBe('concurrent');
    });
  });

  describe('mergeVectorClocks', () => {
    it('should take maximum for each device', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 1 };
      const clockB: VectorClock = { 'device-a': 2, 'device-b': 5 };

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual({ 'device-a': 3, 'device-b': 5 });
    });

    it('should include devices only in A', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-c': 7 };
      const clockB: VectorClock = { 'device-b': 2 };

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual({ 'device-a': 3, 'device-b': 2, 'device-c': 7 });
    });

    it('should include devices only in B', () => {
      const clockA: VectorClock = { 'device-a': 3 };
      const clockB: VectorClock = { 'device-b': 2, 'device-c': 4 };

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual({ 'device-a': 3, 'device-b': 2, 'device-c': 4 });
    });

    it('should not mutate original clocks', () => {
      const clockA: VectorClock = { 'device-a': 3 };
      const clockB: VectorClock = { 'device-b': 2 };

      mergeVectorClocks(clockA, clockB);

      expect(clockA).toEqual({ 'device-a': 3 });
      expect(clockB).toEqual({ 'device-b': 2 });
    });

    it('should handle empty clocks', () => {
      const clockA: VectorClock = {};
      const clockB: VectorClock = { 'device-a': 5 };

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual({ 'device-a': 5 });
    });

    it('should handle both empty clocks', () => {
      const clockA: VectorClock = {};
      const clockB: VectorClock = {};

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual({});
    });

    it('should handle many devices', () => {
      const clockA: VectorClock = { a: 10, b: 5, c: 20 };
      const clockB: VectorClock = { a: 8, b: 15, d: 3 };

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual({ a: 10, b: 15, c: 20, d: 3 });
    });
  });

  describe('happensBefore', () => {
    it('should return true when B happened before A (A has larger counters)', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const clockB: VectorClock = { 'device-a': 2, 'device-b': 1 };

      expect(happensBefore(clockA, clockB)).toBe(true);
      expect(happensBefore(clockB, clockA)).toBe(false);
    });

    it('should return false for concurrent clocks', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 1 };
      const clockB: VectorClock = { 'device-a': 2, 'device-b': 5 };

      expect(happensBefore(clockA, clockB)).toBe(false);
      expect(happensBefore(clockB, clockA)).toBe(false);
    });

    it('should return false for identical clocks', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const clockB: VectorClock = { 'device-a': 3, 'device-b': 2 };

      expect(happensBefore(clockA, clockB)).toBe(false);
    });
  });

  describe('areConcurrent', () => {
    it('should return true for concurrent clocks', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 1 };
      const clockB: VectorClock = { 'device-a': 2, 'device-b': 5 };

      expect(areConcurrent(clockA, clockB)).toBe(true);
    });

    it('should return false for sequential clocks (B > A)', () => {
      const clockA: VectorClock = { 'device-a': 2, 'device-b': 1 };
      const clockB: VectorClock = { 'device-a': 3, 'device-b': 2 };

      expect(areConcurrent(clockA, clockB)).toBe(false);
    });

    it('should return false for sequential clocks (A > B)', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const clockB: VectorClock = { 'device-a': 2, 'device-b': 1 };

      expect(areConcurrent(clockA, clockB)).toBe(false);
    });

    it('should return false for identical clocks', () => {
      const clockA: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const clockB: VectorClock = { 'device-a': 3, 'device-b': 2 };

      expect(areConcurrent(clockA, clockB)).toBe(false);
    });
  });

  describe('cloneVectorClock', () => {
    it('should create a copy of the clock', () => {
      const original: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const cloned = cloneVectorClock(original);

      expect(cloned).toEqual(original);
    });

    it('should not mutate original when clone is modified', () => {
      const original: VectorClock = { 'device-a': 3, 'device-b': 2 };
      const cloned = cloneVectorClock(original);

      cloned['device-c'] = 5;

      expect(original).toEqual({ 'device-a': 3, 'device-b': 2 });
      expect(cloned).toEqual({ 'device-a': 3, 'device-b': 2, 'device-c': 5 });
    });

    it('should handle empty clock', () => {
      const original: VectorClock = {};
      const cloned = cloneVectorClock(original);

      expect(cloned).toEqual({});
    });
  });

  describe('Real-world scenarios', () => {
    it('should detect sequential updates from same device', () => {
      let clock = createVectorClock('laptop');
      const v1 = clock; // { laptop: 1 }

      clock = incrementVectorClock(clock, 'laptop');
      const v2 = clock; // { laptop: 2 }

      clock = incrementVectorClock(clock, 'laptop');
      const v3 = clock; // { laptop: 3 }

      expect(compareVectorClocks(v1, v2)).toBe('b_before_a'); // v2 is greater
      expect(compareVectorClocks(v2, v3)).toBe('b_before_a'); // v3 is greater
      expect(compareVectorClocks(v1, v3)).toBe('b_before_a'); // v3 is greater
    });

    it('should detect conflict in multi-device scenario', () => {
      // Both devices start from same state
      const base: VectorClock = { laptop: 5, phone: 3 };

      // Laptop makes change
      const laptopClock = incrementVectorClock(base, 'laptop');
      // { laptop: 6, phone: 3 }

      // Phone makes change (without seeing laptop's change)
      const phoneClock = incrementVectorClock(base, 'phone');
      // { laptop: 5, phone: 4 }

      // These are concurrent - conflict!
      expect(areConcurrent(laptopClock, phoneClock)).toBe(true);
    });

    it('should properly merge after conflict resolution', () => {
      const laptopClock: VectorClock = { laptop: 6, phone: 3 };
      const phoneClock: VectorClock = { laptop: 5, phone: 4 };

      // After resolving conflict, merge clocks
      const resolved = mergeVectorClocks(laptopClock, phoneClock);
      // { laptop: 6, phone: 4 }

      // Merged clock has greater or equal values than both
      // resolved={laptop:6,phone:4}, laptopClock={laptop:6,phone:3}, phoneClock={laptop:5,phone:4}
      expect(compareVectorClocks(resolved, laptopClock)).toBe('a_before_b'); // resolved has phone:4 > 3
      expect(compareVectorClocks(resolved, phoneClock)).toBe('a_before_b'); // resolved has laptop:6 > 5
    });

    it('should handle three-device conflict', () => {
      const base: VectorClock = { a: 1, b: 1, c: 1 };

      const clockA = incrementVectorClock(base, 'a'); // { a: 2, b: 1, c: 1 }
      const clockB = incrementVectorClock(base, 'b'); // { a: 1, b: 2, c: 1 }
      const clockC = incrementVectorClock(base, 'c'); // { a: 1, b: 1, c: 2 }

      // All three are concurrent with each other
      expect(areConcurrent(clockA, clockB)).toBe(true);
      expect(areConcurrent(clockB, clockC)).toBe(true);
      expect(areConcurrent(clockA, clockC)).toBe(true);
    });

    it('should detect cascade of changes', () => {
      // Device A makes change
      let clock: VectorClock = { a: 1 };

      // Device B syncs and makes change
      clock = incrementVectorClock(clock, 'b'); // { a: 1, b: 1 }

      // Device C syncs from B and makes change
      clock = incrementVectorClock(clock, 'c'); // { a: 1, b: 1, c: 1 }

      // Device A syncs from C and makes change
      clock = incrementVectorClock(clock, 'a'); // { a: 2, b: 1, c: 1 }

      const initial: VectorClock = { a: 1 };
      const final = clock;

      // Final happened after initial (has some greater values)
      // Note: final={a:2,b:1,c:1}, initial={a:1}
      // compareVectorClocks compares: final.a=2 > initial.a=1, so result is 'a_before_b'
      expect(compareVectorClocks(final, initial)).toBe('a_before_b');
    });
  });
});
