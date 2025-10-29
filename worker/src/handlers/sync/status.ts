import type { Env, RequestContext, StatusResponse } from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { STORAGE } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SYNC:STATUS');

/**
 * Get sync status
 * GET /api/sync/status
 */
export async function status(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const userId = ctx.userId!;

    // Get sync metadata
    const metadata = await env.DB.prepare(
      `SELECT last_sync_at FROM sync_metadata
       WHERE user_id = ?
       ORDER BY last_sync_at DESC
       LIMIT 1`
    )
      .bind(userId)
      .first();

    // Count tasks
    const taskCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM encrypted_tasks WHERE user_id = ? AND deleted_at IS NULL'
    )
      .bind(userId)
      .first();

    // Count conflicts
    const conflictCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM conflict_log WHERE user_id = ? AND resolution = "manual"'
    )
      .bind(userId)
      .first();

    // Count devices
    const deviceCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM devices WHERE user_id = ? AND is_active = 1'
    )
      .bind(userId)
      .first();

    const response: StatusResponse = {
      lastSyncAt: (metadata?.last_sync_at as number) || null,
      pendingPushCount: 0, // Client-side only
      pendingPullCount: 0, // Would need more complex query
      conflictCount: (conflictCount?.count as number) || 0,
      deviceCount: (deviceCount?.count as number) || 0,
      storageUsed: ((taskCount?.count as number) || 0) * STORAGE.TASK_SIZE_ESTIMATE,
      storageQuota: STORAGE.DEFAULT_QUOTA,
    };

    return jsonResponse(response, 200, origin);
  } catch (error) {
    logger.error('Status check failed', error as Error, { userId: ctx.userId, operation: 'status' });
    return errorResponse('Status check failed', 500, origin);
  }
}
