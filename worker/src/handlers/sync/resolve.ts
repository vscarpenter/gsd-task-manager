import type { Env, RequestContext } from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { resolveRequestSchema } from '../../schemas';
import { generateId } from '../../utils/crypto';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SYNC:RESOLVE');

/**
 * Resolve a conflict
 * POST /api/sync/resolve
 */
export async function resolve(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const userId = ctx.userId!;
    const body = await request.json();
    const validated = resolveRequestSchema.parse(body);

    // For now, simple resolution - accept merged task if provided
    if (validated.resolution === 'merge' && validated.mergedTask) {
      await env.DB.prepare(
        `UPDATE encrypted_tasks
         SET encrypted_blob = ?, nonce = ?, version = version + 1,
             vector_clock = ?, updated_at = ?, checksum = ?
         WHERE id = ? AND user_id = ?`
      )
        .bind(
          validated.mergedTask.encryptedBlob,
          validated.mergedTask.nonce,
          JSON.stringify(validated.mergedTask.vectorClock),
          Date.now(),
          validated.mergedTask.checksum,
          validated.taskId,
          userId
        )
        .run();

      // Log conflict resolution
      await env.DB.prepare(
        `INSERT INTO conflict_log
         (id, user_id, task_id, conflict_type, device_a, device_b, resolution, resolved_at)
         VALUES (?, ?, ?, 'concurrent_edit', '', '', 'manual', ?)`
      )
        .bind(generateId(), userId, validated.taskId, Date.now())
        .run();
    }

    logger.info('Conflict resolved', { userId, taskId: validated.taskId });

    return jsonResponse({ success: true }, 200, origin);
  } catch (error: unknown) {
    logger.error('Conflict resolution failed', error as Error, { userId: ctx.userId, operation: 'resolve' });
    if ((error as Error).name === 'ZodError') {
      return errorResponse('Invalid request data', 400, origin);
    }
    return errorResponse('Conflict resolution failed', 500, origin);
  }
}
