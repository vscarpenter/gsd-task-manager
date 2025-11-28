import type { Env, RequestContext, StatsResponse } from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SYNC:STATS');

/**
 * Get task statistics
 * GET /api/stats
 *
 * Returns all encrypted task blobs plus aggregated metadata.
 * The client (MCP server) decrypts tasks locally to generate detailed stats.
 */
export async function stats(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const userId = ctx.userId!;

    // Fetch all encrypted tasks for the user
    const tasks = await env.DB.prepare(
      `SELECT
        id,
        encrypted_blob,
        nonce,
        created_at,
        updated_at,
        deleted_at
       FROM encrypted_tasks
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
      .bind(userId)
      .all();

    if (!tasks.results) {
      return errorResponse('Failed to fetch tasks', 500, origin);
    }

    // Calculate metadata
    const allTasks = tasks.results;
    const activeTasks = allTasks.filter((t) => !t.deleted_at);
    const deletedTasks = allTasks.filter((t) => t.deleted_at);

    const createdDates = allTasks
      .map((t) => t.created_at as number)
      .filter((d) => d > 0);
    const oldestTaskDate = createdDates.length > 0 ? Math.min(...createdDates) : null;
    const newestTaskDate = createdDates.length > 0 ? Math.max(...createdDates) : null;

    // Estimate storage (encrypted blob length + metadata overhead)
    const storageUsed = allTasks.reduce((sum, task) => {
      const blobSize = (task.encrypted_blob as string).length;
      const metadataSize = 200; // Rough estimate for metadata
      return sum + blobSize + metadataSize;
    }, 0);

    // Format response
    const response: StatsResponse = {
      tasks: allTasks.map((task) => ({
        id: task.id as string,
        encryptedBlob: task.encrypted_blob as string,
        nonce: task.nonce as string,
        createdAt: task.created_at as number,
        updatedAt: task.updated_at as number,
        deletedAt: (task.deleted_at as number | null) || null,
      })),
      metadata: {
        totalCount: allTasks.length,
        activeCount: activeTasks.length,
        deletedCount: deletedTasks.length,
        oldestTaskDate,
        newestTaskDate,
        storageUsed,
      },
    };

    logger.info('Stats fetched successfully', {
      userId,
      totalTasks: allTasks.length,
      activeTasks: activeTasks.length,
      deletedTasks: deletedTasks.length,
    });

    return jsonResponse(response, 200, origin);
  } catch (error) {
    logger.error('Stats fetch failed', error as Error, {
      userId: ctx.userId,
      operation: 'stats',
    });
    return errorResponse('Stats fetch failed', 500, origin);
  }
}
