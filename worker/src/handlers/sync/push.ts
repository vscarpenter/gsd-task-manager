import type {
  Env,
  RequestContext,
  PushRequest,
  PushResponse,
} from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { pushRequestSchema } from '../../schemas';
import { compareVectorClocks } from '../../utils/vector-clock';
import { generateId } from '../../utils/crypto';
import { createLogger } from '../../utils/logger';
import { getServerVectorClock, parseVectorClock } from './helpers';
import { STORAGE } from '../../config';

const logger = createLogger('SYNC:PUSH');

/**
 * Push local changes to server
 * POST /api/sync/push
 */
export async function push(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const userId = ctx.userId!;
    const body = await request.json();
    const validated = pushRequestSchema.parse(body) as PushRequest;
    const deviceId = ctx.deviceId!;

    if (validated.deviceId !== deviceId) {
      logger.warn('Device mismatch on push', { userId, tokenDeviceId: deviceId, bodyDeviceId: validated.deviceId });
      return errorResponse('Device mismatch', 403, origin);
    }

    const maxTasks = Math.floor(STORAGE.DEFAULT_QUOTA / STORAGE.TASK_SIZE_ESTIMATE);
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM encrypted_tasks WHERE user_id = ? AND deleted_at IS NULL'
    )
      .bind(userId)
      .first();
    let activeTaskCount = (countResult?.count as number) || 0;
    let newTaskCount = 0;

    const results: PushResponse = {
      accepted: [],
      rejected: [],
      conflicts: [],
      serverVectorClock: {},
    };

    // Process each operation
    for (const op of validated.operations) {
      try {
        // FIX #3: Fetch existing task including soft-deleted ones for proper conflict detection
        const existing = await env.DB.prepare(
          'SELECT * FROM encrypted_tasks WHERE id = ? AND user_id = ?'
        )
          .bind(op.taskId, userId)
          .first();

        // Handle delete operation
        if (op.type === 'delete') {
          if (existing) {
            // FIX #3: Check for delete conflicts using vector clocks
            const existingClock = parseVectorClock(existing.vector_clock as string);
            const comparison = compareVectorClocks(existingClock, op.vectorClock);

            logger.info('Delete operation vector clock comparison', {
              taskId: op.taskId,
              comparison,
              existingClock,
              incomingClock: op.vectorClock,
            });

            // If incoming delete is stale or concurrent, report conflict
            if (comparison === 'a_before_b') {
              // Server version is newer than delete request - conflict!
              logger.info('Delete conflict: server has newer version', {
                taskId: op.taskId,
                existingClock,
                incomingClock: op.vectorClock,
              });

              results.conflicts.push({
                taskId: op.taskId,
                reason: 'delete_edit',
                existingClock,
                incomingClock: op.vectorClock,
              });
              continue;
            } else if (comparison === 'concurrent') {
              // Concurrent edits - conflict!
              logger.info('Delete conflict: concurrent modifications', {
                taskId: op.taskId,
                existingClock,
                incomingClock: op.vectorClock,
              });

              results.conflicts.push({
                taskId: op.taskId,
                reason: 'concurrent_edit',
                existingClock,
                incomingClock: op.vectorClock,
              });
              continue;
            }

            // Delete is newer or equal, proceed with soft delete
            await env.DB.prepare(
              `UPDATE encrypted_tasks
               SET deleted_at = ?, updated_at = ?, vector_clock = ?, last_modified_device = ?
               WHERE id = ? AND user_id = ?`
            )
              .bind(
                Date.now(),
                Date.now(),
                JSON.stringify(op.vectorClock),
                deviceId,
                op.taskId,
                userId
              )
              .run();

            if (!existing.deleted_at) {
              activeTaskCount = Math.max(0, activeTaskCount - 1);
            }
          }
          results.accepted.push(op.taskId);
          continue;
        }

        // Validate required fields for create/update
        if (!op.encryptedBlob || !op.nonce || !op.checksum) {
          results.rejected.push({
            taskId: op.taskId,
            reason: 'validation_error',
            details: 'Missing required fields: encryptedBlob, nonce, or checksum',
          });
          continue;
        }

        // Check for conflicts
        if (existing) {
          const existingClock = parseVectorClock(existing.vector_clock as string);
          const comparison = compareVectorClocks(existingClock, op.vectorClock);

          if (comparison === 'concurrent') {
            results.conflicts.push({
              taskId: op.taskId,
              reason: 'concurrent_edit',
              existingClock,
              incomingClock: op.vectorClock,
            });
            continue;
          }

          // Update existing task
          await env.DB.prepare(
            `UPDATE encrypted_tasks
             SET encrypted_blob = ?, nonce = ?, version = version + 1,
                 vector_clock = ?, updated_at = ?, last_modified_device = ?, checksum = ?
             WHERE id = ? AND user_id = ?`
          )
            .bind(
              op.encryptedBlob,
              op.nonce,
              JSON.stringify(op.vectorClock),
              Date.now(),
              deviceId,
              op.checksum,
              op.taskId,
              userId
            )
            .run();
        } else {
          if (activeTaskCount + newTaskCount + 1 > maxTasks) {
            results.rejected.push({
              taskId: op.taskId,
              reason: 'quota_exceeded',
              details: 'Storage quota exceeded',
            });
            continue;
          }

          // Insert new task
          await env.DB.prepare(
            `INSERT INTO encrypted_tasks
             (id, user_id, encrypted_blob, nonce, version, vector_clock,
              created_at, updated_at, last_modified_device, checksum)
             VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
          )
            .bind(
              op.taskId,
              userId,
              op.encryptedBlob,
              op.nonce,
              JSON.stringify(op.vectorClock),
              Date.now(),
              Date.now(),
              deviceId,
              op.checksum
            )
            .run();

          newTaskCount += 1;
        }

        results.accepted.push(op.taskId);
      } catch (error: unknown) {
        logger.error('Task processing failed', error as Error, { userId, taskId: op.taskId, operation: 'push' });
        results.rejected.push({
          taskId: op.taskId,
          reason: 'validation_error',
          details: (error as Error).message,
        });
      }
    }

    // Get server vector clock (merged from all tasks)
    results.serverVectorClock = await getServerVectorClock(env.DB, userId);

    // Update sync metadata
    await env.DB.prepare(
      `INSERT OR REPLACE INTO sync_metadata
       (user_id, device_id, last_sync_at, last_push_vector, last_pull_vector, sync_status)
       VALUES (?, ?, ?, ?, '{}', ?)`
    )
      .bind(
        userId,
        deviceId,
        Date.now(),
        JSON.stringify(validated.clientVectorClock),
        results.conflicts.length > 0 ? 'conflict' : 'success'
      )
      .run();

    // Log sync operation
    await env.DB.prepare(
      `INSERT INTO sync_operations (id, user_id, device_id, operation_type, vector_clock, created_at)
       VALUES (?, ?, ?, 'push', ?, ?)`
    )
      .bind(
        generateId(),
        userId,
        deviceId,
        JSON.stringify(validated.clientVectorClock),
        Date.now()
      )
      .run();

    logger.info('Push completed', {
      userId,
      deviceId,
      accepted: results.accepted.length,
      rejected: results.rejected.length,
      conflicts: results.conflicts.length,
    });

    return jsonResponse(results, 200, origin);
  } catch (error: unknown) {
    logger.error('Push failed', error as Error, { userId: ctx.userId, operation: 'push' });
    if ((error as Error).name === 'ZodError') {
      return errorResponse('Invalid request data', 400, origin);
    }
    return errorResponse('Push failed', 500, origin);
  }
}
