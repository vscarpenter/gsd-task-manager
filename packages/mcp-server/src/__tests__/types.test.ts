import { describe, expect, it } from 'vitest';
import { pbTaskToTask, taskToPBFields } from '../types.js';
import type { PBTask, Task } from '../types.js';

function pbTask(overrides: Partial<PBTask> = {}): PBTask {
  return {
    id: 'record-1',
    task_id: 'task-1',
    owner: 'user-1',
    title: 'Mapped task',
    description: 'Details',
    urgent: true,
    important: false,
    quadrant: 'urgent-not-important',
    due_date: '2026-08-06T00:00:00.000Z',
    completed: true,
    completed_at: '2026-08-05T12:00:00.000Z',
    recurrence: 'weekly',
    tags: ['work'],
    subtasks: [{ id: 'sub-1', title: 'Step', completed: false }],
    dependencies: ['dep-1'],
    notification_enabled: false,
    notify_before: 30,
    notification_sent: true,
    last_notification_at: '2026-08-05T11:30:00.000Z',
    snoozed_until: '2026-08-06T09:00:00.000Z',
    estimated_minutes: 45,
    time_spent: 10,
    time_entries: [{ id: 'time-1', startedAt: '2026-08-05T10:00:00.000Z' }],
    client_created_at: '2026-08-01T00:00:00.000Z',
    client_updated_at: '2026-08-05T12:00:00.000Z',
    device_id: 'device-1',
    created: '2026-08-01T00:00:00.000Z',
    updated: '2026-08-05T12:00:00.000Z',
    ...overrides,
  };
}

describe('pbTaskToTask', () => {
  it('maps populated PocketBase fields to the public task shape', () => {
    expect(pbTaskToTask(pbTask())).toMatchObject({
      id: 'task-1',
      completedAt: '2026-08-05T12:00:00.000Z',
      dueDate: '2026-08-06T00:00:00.000Z',
      recurrence: 'weekly',
      notificationEnabled: false,
      notifyBefore: 30,
      notificationSent: true,
      lastNotificationAt: '2026-08-05T11:30:00.000Z',
      snoozedUntil: '2026-08-06T09:00:00.000Z',
      estimatedMinutes: 45,
      timeSpent: 10,
    });
  });

  it('applies safe defaults for sparse and legacy records', () => {
    const sparse = pbTask({
      description: '',
      completed_at: '',
      due_date: '',
      recurrence: 'unexpected',
      tags: undefined as never,
      subtasks: undefined as never,
      dependencies: undefined as never,
      notification_enabled: undefined as never,
      notify_before: undefined as never,
      notification_sent: undefined as never,
      last_notification_at: '',
      snoozed_until: '',
      estimated_minutes: undefined as never,
      time_spent: undefined as never,
      time_entries: undefined as never,
      client_created_at: '',
      client_updated_at: '',
    });

    expect(pbTaskToTask(sparse)).toEqual(expect.objectContaining({
      description: '',
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notifyBefore: undefined,
      notificationSent: false,
      estimatedMinutes: undefined,
      timeSpent: 0,
      timeEntries: [],
      createdAt: sparse.created,
      updatedAt: sparse.updated,
    }));
    expect(pbTaskToTask(sparse)).not.toHaveProperty('completedAt');
    expect(pbTaskToTask(sparse)).not.toHaveProperty('dueDate');
  });
});

describe('taskToPBFields', () => {
  it('maps populated task fields to PocketBase', () => {
    const task = pbTaskToTask(pbTask());

    expect(taskToPBFields(task, 'user-1', 'device-1')).toMatchObject({
      task_id: 'task-1',
      owner: 'user-1',
      device_id: 'device-1',
      completed_at: '2026-08-05T12:00:00.000Z',
      due_date: '2026-08-06T00:00:00.000Z',
      notification_enabled: false,
      notify_before: 30,
    });
  });

  it('applies write defaults for absent optional task fields', () => {
    const sparse: Task = {
      id: 'task-2',
      title: 'Sparse',
      description: '',
      urgent: false,
      important: false,
      quadrant: 'not-urgent-not-important',
      completed: false,
      tags: undefined as never,
      subtasks: undefined as never,
      recurrence: undefined as never,
      dependencies: undefined as never,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    };

    expect(taskToPBFields(sparse, 'user-1', 'device-1')).toMatchObject({
      description: '',
      due_date: '',
      completed_at: '',
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notification_enabled: true,
      notify_before: 0,
      notification_sent: false,
      last_notification_at: '',
      snoozed_until: '',
      estimated_minutes: 0,
      time_spent: 0,
      time_entries: [],
    });
  });
});
