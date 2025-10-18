import type { VectorClock } from '../types';

/**
 * Compare two vector clocks to determine causality
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
  return 'concurrent';
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
