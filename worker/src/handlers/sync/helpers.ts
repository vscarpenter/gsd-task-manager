import type { VectorClock } from '../../types';
import { mergeVectorClocks } from '../../utils/vector-clock';

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
    const clock: VectorClock = JSON.parse(task.vector_clock as string);
    merged = mergeVectorClocks(merged, clock);
  }

  return merged;
}
