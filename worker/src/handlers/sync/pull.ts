import type {
  Env,
  RequestContext,
  PullRequest,
  PullResponse,
  VectorClock,
} from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { pullRequestSchema } from '../../schemas';
import { generateId } from '../../utils/crypto';
import { createLogger } from '../../utils/logger';
import { getServerVectorClock } from './helpers';

const logger = createLogger('SYNC:PULL');

/**
 * Pull remote changes from server
 * POST /api/sync/pull
 */
export async function pull(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const userId = ctx.userId!;
    const body = await request.json();
    const validated = pullRequestSchema.parse(body) as PullRequest;

    const limit = validated.limit || 50;
    const sinceTimestamp = validated.sinceTimestamp || 0;

    const response: PullResponse = {
      tasks: [],
      deletedTaskIds: [],
      serverVectorClock: {},
      conflicts: [],
      hasMore: false,
      nextCursor: undefined,
    };

    // Fetch tasks updated since last sync
    // FIX #4: Use >= instead of > to catch edge-case millisecond timing
    const tasks = await env.DB.prepare(
      `SELECT * FROM encrypted_tasks
       WHERE user_id = ? AND updated_at >= ? AND deleted_at IS NULL
       ORDER BY updated_at ASC
       LIMIT ?`
    )
      .bind(userId, sinceTimestamp, limit + 1)
      .all();

    // Check if more results exist
    if (tasks.results && tasks.results.length > limit) {
      response.hasMore = true;
      response.nextCursor = (tasks.results[limit - 1].updated_at as number)?.toString();
      tasks.results = tasks.results.slice(0, limit);
    }

    // FIX #6: Debug logging for pull processing
    logger.info('Processing tasks for pull', {
      userId,
      deviceId: validated.deviceId,
      sinceTimestamp,
      sinceDate: sinceTimestamp > 0 ? new Date(sinceTimestamp).toISOString() : 'epoch',
      tasksFound: tasks.results?.length || 0,
      clientVectorClock: validated.lastVectorClock,
    });

    // BULLETPROOF FIX: Always send all tasks updated since lastSyncAt
    // Vector clocks are only used for conflict detection, NOT for filtering
    // This ensures new tasks from other devices always get pulled
    for (const task of tasks.results || []) {
      const taskClock: VectorClock = JSON.parse(task.vector_clock as string);

      logger.info('Processing task for pull', {
        taskId: task.id as string,
        taskUpdatedAt: task.updated_at as number,
        taskUpdatedDate: new Date(task.updated_at as number).toISOString(),
        serverClock: taskClock,
      });

      // Always send the task - let client handle conflicts and deduplication
      response.tasks.push({
        id: task.id as string,
        encryptedBlob: task.encrypted_blob as string,
        nonce: task.nonce as string,
        version: task.version as number,
        vectorClock: taskClock,
        updatedAt: task.updated_at as number,
        checksum: task.checksum as string,
      });

      logger.info('Task queued for client', {
        taskId: task.id as string,
        reason: 'timestamp-based-pull',
      });
    }

    // Fetch deleted tasks
    // FIX #4: Use >= for consistency with updated_at query
    const deletedTasks = await env.DB.prepare(
      `SELECT id FROM encrypted_tasks
       WHERE user_id = ? AND deleted_at >= ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at ASC
       LIMIT ?`
    )
      .bind(userId, sinceTimestamp, limit)
      .all();

    response.deletedTaskIds = (deletedTasks.results || []).map(
      (t: any) => t.id as string
    );

    // Get server vector clock
    response.serverVectorClock = await getServerVectorClock(env.DB, userId);

    // Update sync metadata
    await env.DB.prepare(
      `INSERT OR REPLACE INTO sync_metadata
       (user_id, device_id, last_sync_at, last_pull_vector, last_push_vector, sync_status)
       VALUES (?, ?, ?, ?, '{}', 'success')`
    )
      .bind(
        userId,
        validated.deviceId,
        Date.now(),
        JSON.stringify(response.serverVectorClock)
      )
      .run();

    // Log sync operation
    await env.DB.prepare(
      `INSERT INTO sync_operations (id, user_id, device_id, operation_type, vector_clock, created_at)
       VALUES (?, ?, ?, 'pull', ?, ?)`
    )
      .bind(
        generateId(),
        userId,
        validated.deviceId,
        JSON.stringify(response.serverVectorClock),
        Date.now()
      )
      .run();

    logger.info('Pull completed', {
      userId,
      deviceId: validated.deviceId,
      tasksCount: response.tasks.length,
      deletedCount: response.deletedTaskIds.length,
      conflicts: response.conflicts.length,
    });

    return jsonResponse(response, 200, origin);
  } catch (error: any) {
    logger.error('Pull failed', error, { userId: ctx.userId, operation: 'pull' });
    if (error.name === 'ZodError') {
      return errorResponse('Invalid request data', 400, origin);
    }
    return errorResponse('Pull failed', 500, origin);
  }
}
