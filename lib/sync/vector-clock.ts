/**
 * Vector clock implementation for conflict detection
 * Tracks causality between distributed operations
 *
 * WHY VECTOR CLOCKS?
 * In distributed systems without a central clock, we need to determine the order
 * of events across multiple devices. Vector clocks solve this by tracking a counter
 * for each device (node) in the system.
 *
 * HOW IT WORKS:
 * - Each device maintains a vector (map) of counters: { deviceA: 3, deviceB: 5 }
 * - When a device makes a change, it increments its own counter
 * - When comparing two clocks, we can determine:
 *   1. If one happened-before the other (all counters ≤ and at least one <)
 *   2. If they're concurrent/conflicting (some counters higher, some lower)
 *   3. If they're identical (all counters equal)
 *
 * EXAMPLE:
 * Device A: { A: 3, B: 1 } and Device B: { A: 2, B: 5 }
 * → Neither "happened-before" the other → CONCURRENT (conflict!)
 *
 * This allows us to detect true conflicts vs. safe sequential updates in
 * a multi-device environment without requiring synchronized clocks.
 */

import type { VectorClock } from './types';

/**
 * Compare two vector clocks to determine causality
 *
 * Determines the relationship between two events in a distributed system:
 * - 'a_before_b': All of A's counters ≤ B's counters (safe to use B)
 * - 'b_before_a': All of B's counters ≤ A's counters (safe to use A)
 * - 'concurrent': Mixed counters (CONFLICT - needs resolution)
 * - 'identical': Exact same clocks (same event)
 */
export function compareVectorClocks(
  a: VectorClock,
  b: VectorClock
): 'concurrent' | 'a_before_b' | 'b_before_a' | 'identical' {
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);

  let aGreater = false;
  let bGreater = false;

  for (const device of allDevices) {
    const aVal = a[device] || 0;
    const bVal = b[device] || 0;

    if (aVal > bVal) aGreater = true;
    if (bVal > aVal) bGreater = true;
  }

  if (!aGreater && !bGreater) return 'identical';
  if (aGreater && !bGreater) return 'a_before_b';
  if (bGreater && !aGreater) return 'b_before_a';
  return 'concurrent'; // Conflict!
}

/**
 * Merge two vector clocks (take maximum for each device)
 */
export function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const result: VectorClock = { ...a };

  for (const [device, timestamp] of Object.entries(b)) {
    result[device] = Math.max(result[device] || 0, timestamp);
  }

  return result;
}

/**
 * Increment vector clock for a device
 */
export function incrementVectorClock(
  clock: VectorClock,
  deviceId: string
): VectorClock {
  return {
    ...clock,
    [deviceId]: (clock[deviceId] || 0) + 1,
  };
}

/**
 * Check if clock A happened before clock B
 */
export function happensBefore(a: VectorClock, b: VectorClock): boolean {
  return compareVectorClocks(a, b) === 'a_before_b';
}

/**
 * Check if two clocks are concurrent (conflict)
 */
export function areConcurrent(a: VectorClock, b: VectorClock): boolean {
  return compareVectorClocks(a, b) === 'concurrent';
}

/**
 * Create initial vector clock for a device
 */
export function createVectorClock(deviceId: string): VectorClock {
  return { [deviceId]: 1 };
}

/**
 * Clone a vector clock
 */
export function cloneVectorClock(clock: VectorClock): VectorClock {
  return { ...clock };
}
