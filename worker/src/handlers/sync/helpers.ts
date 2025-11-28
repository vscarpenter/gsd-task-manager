import type { VectorClock } from '../../types';
import { mergeVectorClocks } from '../../utils/vector-clock';

/**
 * Parse a vector clock from a JSON string
 * Handles null/undefined values safely
 *
 * @param raw - JSON string or null/undefined
 * @returns Parsed VectorClock or empty object
 */
export function parseVectorClock(raw: string | null | undefined): VectorClock {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as VectorClock;
  } catch {
    return {};
  }
}

/**
 * Helper: Get merged server vector clock for a user
 */
export async function getServerVectorClock(
  db: D1Database,
  userId: string
): Promise<VectorClock> {
  const tasks = await db
    .prepare('SELECT vector_clock FROM encrypted_tasks WHERE user_id = ? AND deleted_at IS NULL')
    .bind(userId)
    .all();

  let merged: VectorClock = {};

  for (const task of tasks.results || []) {
    const clock = parseVectorClock(task.vector_clock as string);
    merged = mergeVectorClocks(merged, clock);
  }

  return merged;
}
