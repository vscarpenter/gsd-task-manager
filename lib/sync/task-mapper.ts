/**
 * Task record mapper between local IndexedDB format and PocketBase format
 *
 * The local app uses camelCase TypeScript interfaces; PocketBase collections
 * use snake_case field names. This module provides bidirectional mapping so
 * the PocketBase naming convention stays contained at the sync boundary.
 */

import type { TaskRecord, Subtask, TimeEntry } from '@/lib/types';
import type { QuadrantId, RecurrenceType } from '@/lib/types';
import type { RecordModel } from 'pocketbase';

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
  notify_before: number | null;
  estimated_minutes: number | null;
  time_spent: number;
  time_entries: TimeEntry[];
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
    notify_before: task.notifyBefore ?? null,
    estimated_minutes: task.estimatedMinutes ?? null,
    time_spent: task.timeSpent ?? 0,
    time_entries: task.timeEntries ?? [],
    client_updated_at: task.updatedAt,
    client_created_at: task.createdAt,
    device_id: deviceId,
  };
}

/**
 * Convert a PocketBase record to local TaskRecord format
 */
export function pocketBaseToTaskRecord(record: RecordModel): TaskRecord {
  return {
    id: record['task_id'] as string,
    title: record['title'] as string,
    description: (record['description'] as string) || '',
    urgent: record['urgent'] as boolean,
    important: record['important'] as boolean,
    quadrant: record['quadrant'] as QuadrantId,
    dueDate: (record['due_date'] as string) || undefined,
    completed: record['completed'] as boolean,
    completedAt: (record['completed_at'] as string) || undefined,
    createdAt: record['client_created_at'] as string,
    updatedAt: record['client_updated_at'] as string,
    recurrence: (record['recurrence'] as RecurrenceType) || 'none',
    tags: (record['tags'] as string[]) ?? [],
    subtasks: (record['subtasks'] as Subtask[]) ?? [],
    dependencies: (record['dependencies'] as string[]) ?? [],
    notificationEnabled: (record['notification_enabled'] as boolean) ?? true,
    notifyBefore: (record['notify_before'] as number) ?? undefined,
    notificationSent: false,
    estimatedMinutes: (record['estimated_minutes'] as number) ?? undefined,
    timeSpent: (record['time_spent'] as number) ?? 0,
    timeEntries: (record['time_entries'] as TimeEntry[]) ?? [],
  };
}
