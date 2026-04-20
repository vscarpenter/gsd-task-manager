/**
 * Task record mapper between local IndexedDB format and PocketBase format
 *
 * The local app uses camelCase TypeScript interfaces; PocketBase collections
 * use snake_case field names. This module provides bidirectional mapping so
 * the PocketBase naming convention stays contained at the sync boundary.
 */

import type { TaskRecord, Subtask, TimeEntry } from '@/lib/types';
import type { RecordModel } from 'pocketbase';
import { z } from 'zod';
import { quadrantIdSchema, recurrenceTypeSchema, subtaskSchema, timeEntrySchema } from '@/lib/schema';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_PULL');

/** Shape of a task as stored in the PocketBase `tasks` collection */
export interface PBTaskRecord {
  task_id: string;
  owner: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrant: string;
  due_date: string;
  completed: boolean;
  completed_at: string;
  recurrence: string;
  tags: string[];
  subtasks: Subtask[];
  dependencies: string[];
  notification_enabled: boolean;
  notification_sent: boolean;
  notify_before: number | null;
  last_notification_at: string;
  estimated_minutes: number | null;
  time_spent: number;
  time_entries: TimeEntry[];
  snoozed_until: string;
  client_updated_at: string;
  client_created_at: string;
  device_id: string;
}

/**
 * Convert a local TaskRecord to the PocketBase tasks collection format
 */
export function taskRecordToPocketBase(
  task: TaskRecord,
  ownerId: string,
  deviceId: string
): Partial<PBTaskRecord> {
  return {
    task_id: task.id,
    owner: ownerId,
    title: task.title,
    description: task.description || '',
    urgent: task.urgent,
    important: task.important,
    quadrant: task.quadrant,
    due_date: task.dueDate || '',
    completed: task.completed,
    completed_at: task.completedAt || '',
    recurrence: task.recurrence || 'none',
    tags: task.tags ?? [],
    subtasks: task.subtasks ?? [],
    dependencies: task.dependencies ?? [],
    notification_enabled: task.notificationEnabled ?? true,
    notification_sent: task.notificationSent ?? false,
    notify_before: task.notifyBefore ?? null,
    last_notification_at: task.lastNotificationAt ?? '',
    estimated_minutes: task.estimatedMinutes ?? null,
    time_spent: task.timeSpent ?? 0,
    time_entries: task.timeEntries ?? [],
    snoozed_until: task.snoozedUntil ?? '',
    client_updated_at: task.updatedAt,
    client_created_at: task.createdAt,
    device_id: deviceId,
  };
}

/**
 * Zod schema for validating PocketBase task records at the sync boundary.
 * Uses .strip() to discard unknown fields from the remote response.
 */
const pbTaskRecordSchema = z.object({
  task_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  urgent: z.boolean(),
  important: z.boolean(),
  quadrant: quadrantIdSchema,
  due_date: z.string().default(''),
  completed: z.boolean(),
  completed_at: z.string().default(''),
  client_created_at: z.string(),
  client_updated_at: z.string(),
  recurrence: recurrenceTypeSchema.default('none'),
  tags: z.array(z.string()).default([]),
  subtasks: z.array(subtaskSchema).default([]),
  dependencies: z.array(z.string()).default([]),
  notification_enabled: z.boolean().default(true),
  notification_sent: z.boolean().default(false),
  notify_before: z.number().int().min(0).nullable().default(null),
  last_notification_at: z.string().default(''),
  estimated_minutes: z.number().int().min(0).nullable().default(null),
  time_spent: z.number().int().min(0).default(0),
  time_entries: z.array(timeEntrySchema).default([]),
  snoozed_until: z.string().default(''),
}).strip();

/**
 * Convert a PocketBase record to local TaskRecord format.
 * Validates the remote data with Zod before mapping to catch
 * malformed or unexpected payloads at the sync boundary.
 */
export function pocketBaseToTaskRecord(record: RecordModel): TaskRecord | null {
  const parsed = pbTaskRecordSchema.safeParse(record);

  if (!parsed.success) {
    logger.error('PocketBase record failed validation, skipping', undefined, {
      taskId: record['task_id'] as string,
      errors: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
    });

    return null;
  }

  const r = parsed.data;
  return {
    id: r.task_id,
    title: r.title,
    description: r.description,
    urgent: r.urgent,
    important: r.important,
    quadrant: r.quadrant,
    dueDate: r.due_date || undefined,
    completed: r.completed,
    completedAt: r.completed_at || undefined,
    createdAt: r.client_created_at,
    updatedAt: r.client_updated_at,
    recurrence: r.recurrence,
    tags: r.tags,
    subtasks: r.subtasks,
    dependencies: r.dependencies,
    notificationEnabled: r.notification_enabled,
    notificationSent: r.notification_sent,
    notifyBefore: r.notify_before ?? undefined,
    lastNotificationAt: r.last_notification_at || undefined,
    estimatedMinutes: r.estimated_minutes ?? undefined,
    timeSpent: r.time_spent,
    timeEntries: r.time_entries,
    snoozedUntil: r.snoozed_until || undefined,
  };
}
