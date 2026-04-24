import { z } from 'zod';

// Configuration
export interface GsdConfig {
  pocketBaseUrl: string;
  authToken: string; // PocketBase auth token
}

// PocketBase task record (snake_case, as stored in PB)
export interface PBTask {
  id: string; // PocketBase record ID
  task_id: string; // Client-generated UUID
  owner: string; // PocketBase user ID
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
  subtasks: Array<{ id: string; title: string; completed: boolean }>;
  dependencies: string[];
  notification_enabled: boolean;
  notify_before: number;
  notification_sent: boolean;
  last_notification_at: string;
  snoozed_until: string;
  estimated_minutes: number;
  time_spent: number;
  time_entries: Array<{ id: string; startedAt: string; endedAt?: string; notes?: string }>;
  client_updated_at: string;
  client_created_at: string;
  device_id: string;
  created: string; // PocketBase auto-field
  updated: string; // PocketBase auto-field
}

// Task structure (matches GSD TaskRecord from frontend, camelCase)
export interface Task {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrant: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  tags: string[];
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies: string[];
  notificationEnabled?: boolean;
  notifyBefore?: number;
  notificationSent?: boolean;
  lastNotificationAt?: string;
  snoozedUntil?: string;
  estimatedMinutes?: number;
  timeSpent?: number;
  timeEntries?: Array<{ id: string; startedAt: string; endedAt?: string; notes?: string }>;
  createdAt: string;
  updatedAt: string;
}

// Task filters
export interface TaskFilters {
  quadrant?: string;
  completed?: boolean;
  tags?: string[];
}

// Sync status from PocketBase health
export const syncStatusSchema = z.object({
  code: z.number(),
  message: z.string(),
});

export type SyncStatus = {
  healthy: boolean;
  taskCount: number;
  lastSyncAt: string | null;
};

// Device info
export interface Device {
  id: string;
  name: string | null;
  lastSeenAt: string;
  isActive: boolean;
  isCurrent: boolean;
}

// Task stats
export interface TaskStats {
  totalTasks: number | null;
  activeTasks: number | null;
  completedTasks: number | null;
  lastUpdated: string | null;
  oldestTask: string | null;
  newestTask: string | null;
}

const VALID_RECURRENCES = new Set<Task['recurrence']>(['none', 'daily', 'weekly', 'monthly']);

function isValidRecurrence(value: string): value is Task['recurrence'] {
  return VALID_RECURRENCES.has(value as Task['recurrence']);
}

/**
 * Convert a PocketBase task record to frontend Task format
 */
export function pbTaskToTask(pb: PBTask): Task {
  return {
    id: pb.task_id,
    title: pb.title,
    description: pb.description || '',
    urgent: pb.urgent,
    important: pb.important,
    quadrant: pb.quadrant,
    completed: pb.completed,
    ...(pb.completed_at ? { completedAt: pb.completed_at } : {}),
    ...(pb.due_date ? { dueDate: pb.due_date } : {}),
    tags: pb.tags || [],
    subtasks: pb.subtasks || [],
    recurrence: isValidRecurrence(pb.recurrence) ? pb.recurrence : 'none',
    dependencies: pb.dependencies || [],
    notificationEnabled: pb.notification_enabled ?? true,
    notifyBefore: pb.notify_before ?? undefined,
    notificationSent: pb.notification_sent ?? false,
    ...(pb.last_notification_at ? { lastNotificationAt: pb.last_notification_at } : {}),
    ...(pb.snoozed_until ? { snoozedUntil: pb.snoozed_until } : {}),
    estimatedMinutes: pb.estimated_minutes ?? undefined,
    timeSpent: pb.time_spent ?? 0,
    timeEntries: pb.time_entries ?? [],
    createdAt: pb.client_created_at || pb.created,
    updatedAt: pb.client_updated_at || pb.updated,
  };
}

/**
 * Convert a Task to PocketBase record fields for create/update
 */
export function taskToPBFields(
  task: Task,
  ownerId: string,
  deviceId: string
): Partial<PBTask> {
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
    tags: task.tags || [],
    subtasks: task.subtasks || [],
    dependencies: task.dependencies || [],
    notification_enabled: task.notificationEnabled ?? true,
    notify_before: task.notifyBefore ?? 0,
    notification_sent: task.notificationSent ?? false,
    last_notification_at: task.lastNotificationAt ?? '',
    snoozed_until: task.snoozedUntil ?? '',
    estimated_minutes: task.estimatedMinutes ?? 0,
    time_spent: task.timeSpent ?? 0,
    time_entries: task.timeEntries ?? [],
    client_updated_at: task.updatedAt,
    client_created_at: task.createdAt,
    device_id: deviceId,
  };
}
