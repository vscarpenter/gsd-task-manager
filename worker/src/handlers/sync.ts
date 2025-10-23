import type {
  Env,
  RequestContext,
  PushRequest,
  PullRequest,
  PushResponse,
  PullResponse,
  VectorClock,
  StatusResponse,
  DeviceInfo,
} from '../types';
import { jsonResponse, errorResponse } from '../middleware/cors';
import {
  pushRequestSchema,
  pullRequestSchema,
  resolveRequestSchema,
} from '../schemas';
import { compareVectorClocks, mergeVectorClocks } from '../utils/vector-clock';
import { generateId } from '../utils/crypto';
import { TTL, STORAGE } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('SYNC');

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

    const results: PushResponse = {
      accepted: [],
      rejected: [],
      conflicts: [],
      serverVectorClock: {},
    };

    // Process each operation
    for (const op of validated.operations) {
      try {
        // Fetch existing task (if any)
        const existing = await env.DB.prepare(
          'SELECT * FROM encrypted_tasks WHERE id = ? AND user_id = ? AND deleted_at IS NULL'
        )
          .bind(op.taskId, userId)
          .first();

        // Handle delete operation
        if (op.type === 'delete') {
          if (existing) {
            await env.DB.prepare(
              `UPDATE encrypted_tasks
               SET deleted_at = ?, updated_at = ?, vector_clock = ?, last_modified_device = ?
               WHERE id = ? AND user_id = ?`
            )
              .bind(
                Date.now(),
                Date.now(),
                JSON.stringify(op.vectorClock),
                validated.deviceId,
                op.taskId,
                userId
              )
              .run();
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
          const existingClock: VectorClock = JSON.parse(existing.vector_clock as string);
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
              validated.deviceId,
              op.checksum,
              op.taskId,
              userId
            )
            .run();
        } else {
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
              validated.deviceId,
              op.checksum
            )
            .run();
        }

        results.accepted.push(op.taskId);
      } catch (error: any) {
        logger.error('Task processing failed', error, { userId, taskId: op.taskId, operation: 'push' });
        results.rejected.push({
          taskId: op.taskId,
          reason: 'validation_error',
          details: error.message,
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
        validated.deviceId,
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
        validated.deviceId,
        JSON.stringify(validated.clientVectorClock),
        Date.now()
      )
      .run();

    logger.info('Push completed', {
      userId,
      deviceId: validated.deviceId,
      accepted: results.accepted.length,
      rejected: results.rejected.length,
      conflicts: results.conflicts.length,
    });

    return jsonResponse(results, 200, origin);
  } catch (error: any) {
    logger.error('Push failed', error, { userId: ctx.userId, operation: 'push' });
    if (error.name === 'ZodError') {
      return errorResponse('Invalid request data', 400, origin);
    }
    return errorResponse('Push failed', 500, origin);
  }
}

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
      response.nextCursor = tasks.results[limit - 1].updated_at?.toString();
      tasks.results = tasks.results.slice(0, limit);
    }

    // FIX #6: Debug logging for pull processing
    logger.info('Processing tasks for pull', {
      userId,
      deviceId: validated.deviceId,
      tasksFound: tasks.results?.length || 0,
      clientVectorClock: validated.lastVectorClock,
    });

    // Process tasks
    for (const task of tasks.results || []) {
      const taskClock: VectorClock = JSON.parse(task.vector_clock as string);
      const comparison = compareVectorClocks(validated.lastVectorClock, taskClock);

      logger.info('Comparing vector clocks', {
        taskId: task.id,
        comparison,
        clientClock: validated.lastVectorClock,
        serverClock: taskClock,
      });

      // Check for conflicts
      if (comparison === 'concurrent') {
        logger.info('Concurrent conflict detected', {
          taskId: task.id,
          clientClock: validated.lastVectorClock,
          serverClock: taskClock,
        });

        response.conflicts.push({
          taskId: task.id as string,
          reason: 'concurrent_edit',
          existingClock: validated.lastVectorClock,
          incomingClock: taskClock,
        });
        // FIX #1: Still send task data for client-side conflict resolution
        // Client needs the remote version to perform last-write-wins resolution
        response.tasks.push({
          id: task.id as string,
          encryptedBlob: task.encrypted_blob as string,
          nonce: task.nonce as string,
          version: task.version as number,
          vectorClock: taskClock,
          updatedAt: task.updated_at as number,
          checksum: task.checksum as string,
        });
        continue;
      }

      // Only send if server has newer version
      if (comparison === 'a_before_b' || comparison === 'identical') {
        logger.info('Sending task to client', {
          taskId: task.id,
          comparison,
          serverUpdatedAt: task.updated_at,
        });

        response.tasks.push({
          id: task.id as string,
          encryptedBlob: task.encrypted_blob as string,
          nonce: task.nonce as string,
          version: task.version as number,
          vectorClock: taskClock,
          updatedAt: task.updated_at as number,
          checksum: task.checksum as string,
        });
      } else {
        logger.info('Skipping task (client has newer version)', {
          taskId: task.id,
          comparison,
        });
      }
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
  } catch (error: any) {
    logger.error('Conflict resolution failed', error, { userId: ctx.userId, operation: 'resolve' });
    if (error.name === 'ZodError') {
      return errorResponse('Invalid request data', 400, origin);
    }
    return errorResponse('Conflict resolution failed', 500, origin);
  }
}

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

/**
 * List user's devices
 * GET /api/devices
 */
export async function listDevices(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const userId = ctx.userId!;
    const currentDeviceId = ctx.deviceId!;

    const devices = await env.DB.prepare(
      'SELECT id, device_name, last_seen_at, is_active FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC'
    )
      .bind(userId)
      .all();

    const deviceList: DeviceInfo[] = (devices.results || []).map((d: any) => ({
      id: d.id,
      name: d.device_name,
      lastSeenAt: d.last_seen_at,
      isActive: d.is_active === 1,
      isCurrent: d.id === currentDeviceId,
    }));

    return jsonResponse({ devices: deviceList }, 200, origin);
  } catch (error) {
    logger.error('List devices failed', error as Error, { userId: ctx.userId, operation: 'list_devices' });
    return errorResponse('Failed to list devices', 500, origin);
  }
}

/**
 * Revoke a device
 * DELETE /api/devices/:id
 */
export async function revokeDevice(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  let deviceId: string | undefined;
  try {
    const userId = ctx.userId!;
    const url = new URL(request.url);
    deviceId = url.pathname.split('/').pop();

    if (!deviceId) {
      return errorResponse('Device ID required', 400, origin);
    }

    // Deactivate device
    await env.DB.prepare(
      'UPDATE devices SET is_active = 0 WHERE id = ? AND user_id = ?'
    )
      .bind(deviceId, userId)
      .run();

    // Revoke all sessions for this device
    const sessions = await env.KV.list({ prefix: `session:${userId}:` });
    for (const key of sessions.keys) {
      const session = await env.KV.get(key.name, 'json');
      if (session && (session as any).deviceId === deviceId) {
        const jti = key.name.split(':')[2];
        await env.KV.put(`revoked:${userId}:${jti}`, 'true', {
          expirationTtl: TTL.REVOCATION,
        });
        await env.KV.delete(key.name);
      }
    }

    logger.info('Device revoked', { userId, deviceId });

    return jsonResponse({ success: true }, 200, origin);
  } catch (error) {
    logger.error('Revoke device failed', error as Error, { userId: ctx.userId, deviceId, operation: 'revoke_device' });
    return errorResponse('Failed to revoke device', 500, origin);
  }
}

/**
 * Helper: Get merged server vector clock for a user
 */
async function getServerVectorClock(db: D1Database, userId: string): Promise<VectorClock> {
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
