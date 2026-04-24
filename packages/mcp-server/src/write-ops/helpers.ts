/**
 * Helper functions for write operations
 * Includes ID generation, quadrant logic, and PocketBase push
 */

import type { GsdConfig, PBTask } from '../types.js';
import { taskToPBFields } from '../types.js';
import type { Task } from '../types.js';
import { getPocketBase } from '../pocketbase-client.js';
import { getTaskCache } from '../cache.js';

/** Escape a string value for safe use in PocketBase filter expressions */
function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Generate unique ID for new tasks
 */
export function generateTaskId(): string {
  const uuid = crypto.randomUUID();
  return uuid.replace(/-/g, '');
}

/**
 * Derive quadrant from urgent/important flags
 */
export function deriveQuadrant(urgent: boolean, important: boolean): string {
  if (urgent && important) return 'urgent-important';
  if (!urgent && important) return 'not-urgent-important';
  if (urgent && !important) return 'urgent-not-important';
  return 'not-urgent-not-important';
}

/**
 * Create a task in PocketBase
 */
export async function createTaskInPB(
  config: GsdConfig,
  task: Task,
  ownerId: string,
  deviceId: string
): Promise<void> {
  const pb = getPocketBase(config);
  const fields = taskToPBFields(task, ownerId, deviceId);

  await pb.collection('tasks').create(fields);

  // Invalidate cache after successful write
  getTaskCache().invalidate();
}

/**
 * Update a task in PocketBase (looks up by task_id)
 */
export async function updateTaskInPB(
  config: GsdConfig,
  task: Task,
  ownerId: string,
  deviceId: string
): Promise<void> {
  const pb = getPocketBase(config);
  const pbRecordId = await findPBRecordId(config, task.id);

  const fields = taskToPBFields(task, ownerId, deviceId);
  await pb.collection('tasks').update(pbRecordId, fields);

  // Invalidate cache after successful write
  getTaskCache().invalidate();
}

/**
 * Delete a task in PocketBase (looks up by task_id)
 */
export async function deleteTaskInPB(
  config: GsdConfig,
  taskId: string
): Promise<void> {
  const pb = getPocketBase(config);
  const pbRecordId = await findPBRecordId(config, taskId);

  await pb.collection('tasks').delete(pbRecordId);

  // Invalidate cache after successful write
  getTaskCache().invalidate();
}

/**
 * Find PocketBase record ID by client-side task_id
 */
async function findPBRecordId(config: GsdConfig, taskId: string): Promise<string> {
  const pb = getPocketBase(config);

  try {
    const record = await pb.collection('tasks').getFirstListItem<PBTask>(
      `task_id = "${escapeFilterValue(taskId)}"`
    );
    return record.id;
  } catch {
    throw new Error(`Task not found in PocketBase: ${taskId}`);
  }
}

/**
 * Get the current user's ID and device ID from PocketBase auth.
 *
 * When the MCP server is configured via GSD_AUTH_TOKEN, `getPocketBase` only
 * seeds `authStore.token`; the user record is null until we hydrate it. Reads
 * work header-only, but writes need `ownerId` for the `owner` field.
 */
export async function getAuthInfo(
  config: GsdConfig
): Promise<{ ownerId: string; deviceId: string }> {
  const pb = getPocketBase(config);

  if (!pb.authStore.record?.id && pb.authStore.token) {
    try {
      await pb.collection('users').authRefresh();
    } catch {
      throw new Error(
        `Not authenticated\n\n` +
          `Your auth token may be invalid or expired.\n` +
          `Run: npx gsd-mcp-server --setup`
      );
    }
  }

  const model = pb.authStore.record;
  if (!model?.id) {
    throw new Error(
      `Not authenticated\n\n` +
        `Your auth token may be invalid or expired.\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }

  return {
    ownerId: model.id,
    deviceId: 'mcp-server', // MCP server always uses this device ID
  };
}
