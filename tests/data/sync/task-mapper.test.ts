import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { taskRecordToPocketBase, pocketBaseToTaskRecord } from '@/lib/sync/task-mapper';
import { SCHEMA_LIMITS } from '@/lib/constants/schema';
import type { TaskRecord } from '@/lib/types';

// Mock logger to avoid side effects. Shared spy instance so tests can assert
// on the metadata passed to logger.error (createLogger is called once at
// module load in task-mapper.ts, so every call must return the same object).
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => mockLogger,
}));

function buildLocalTask(overrides?: Partial<TaskRecord>): TaskRecord {
  return {
    id: 'task-123',
    title: 'Test Task',
    description: 'A test task',
    urgent: true,
    important: false,
    quadrant: 'urgent-not-important',
    dueDate: '2026-04-10T12:00:00.000Z',
    completed: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-08T10:00:00.000Z',
    recurrence: 'none',
    tags: ['work', 'review'],
    subtasks: [{ id: 'sub-1', title: 'Subtask 1', completed: false }],
    dependencies: ['task-456'],
    notificationEnabled: true,
    notificationSent: false,
    lastNotificationAt: '2026-04-08T09:45:00.000Z',
    notifyBefore: 15,
    estimatedMinutes: 30,
    timeSpent: 10,
    timeEntries: [],
    snoozedUntil: '2026-04-10T11:30:00.000Z',
    ...overrides,
  };
}

function buildPBRecord(overrides?: Record<string, unknown>) {
  return {
    id: 'pb-record-id',
    collectionId: 'tasks',
    collectionName: 'tasks',
    created: '2026-04-01',
    updated: '2026-04-08',
    task_id: 'task-123',
    owner: 'user-1',
    title: 'Test Task',
    description: 'A test task',
    urgent: true,
    important: false,
    quadrant: 'urgent-not-important',
    due_date: '2026-04-10T12:00:00.000Z',
    completed: false,
    completed_at: '',
    recurrence: 'none',
    tags: ['work', 'review'],
    subtasks: [{ id: 'sub-1', title: 'Subtask 1', completed: false }],
    dependencies: ['task-456'],
    notification_enabled: true,
    notification_sent: false,
    notify_before: 15,
    last_notification_at: '2026-04-08T09:45:00.000Z',
    estimated_minutes: 30,
    time_spent: 10,
    time_entries: [],
    snoozed_until: '2026-04-10T11:30:00.000Z',
    client_created_at: '2026-04-01T00:00:00.000Z',
    client_updated_at: '2026-04-08T10:00:00.000Z',
    device_id: 'device-1',
    ...overrides,
  };
}

describe('task-mapper', () => {
  describe('taskRecordToPocketBase', () => {
    it('should map camelCase local fields to snake_case PB fields', () => {
      const local = buildLocalTask();
      const result = taskRecordToPocketBase(local, 'user-1', 'device-1');

      expect(result.task_id).toBe('task-123');
      expect(result.owner).toBe('user-1');
      expect(result.device_id).toBe('device-1');
      expect(result.title).toBe('Test Task');
      expect(result.due_date).toBe('2026-04-10T12:00:00.000Z');
      expect(result.completed_at).toBe('');
      expect(result.client_updated_at).toBe('2026-04-08T10:00:00.000Z');
      expect(result.client_created_at).toBe('2026-04-01T00:00:00.000Z');
      expect(result.notification_enabled).toBe(true);
      expect(result.notification_sent).toBe(false);
      expect(result.notify_before).toBe(15);
      expect(result.last_notification_at).toBe('2026-04-08T09:45:00.000Z');
      expect(result.estimated_minutes).toBe(30);
      expect(result.time_spent).toBe(10);
      expect(result.snoozed_until).toBe('2026-04-10T11:30:00.000Z');
    });

    it('should handle optional fields with defaults', () => {
      const local = buildLocalTask({
        dueDate: undefined,
        completedAt: undefined,
        lastNotificationAt: undefined,
        notifyBefore: undefined,
        estimatedMinutes: undefined,
        timeSpent: undefined,
        timeEntries: undefined,
        snoozedUntil: undefined,
        tags: undefined,
      });
      const result = taskRecordToPocketBase(local, 'user-1', 'device-1');

      expect(result.due_date).toBe('');
      expect(result.completed_at).toBe('');
      expect(result.notify_before).toBeNull();
      expect(result.last_notification_at).toBe('');
      expect(result.estimated_minutes).toBeNull();
      expect(result.time_spent).toBe(0);
      expect(result.time_entries).toEqual([]);
      expect(result.snoozed_until).toBe('');
      expect(result.tags).toEqual([]);
    });

    it('should preserve array fields', () => {
      const local = buildLocalTask({
        tags: ['urgent', 'bug'],
        dependencies: ['dep-1', 'dep-2'],
        subtasks: [
          { id: 's1', title: 'Sub 1', completed: true },
          { id: 's2', title: 'Sub 2', completed: false },
        ],
      });
      const result = taskRecordToPocketBase(local, 'user-1', 'device-1');

      expect(result.tags).toEqual(['urgent', 'bug']);
      expect(result.dependencies).toEqual(['dep-1', 'dep-2']);
      expect(result.subtasks).toHaveLength(2);
    });
  });

  describe('pocketBaseToTaskRecord', () => {
    it('should map snake_case PB fields to camelCase local fields', () => {
      const pb = buildPBRecord();
      const existingLocal = buildLocalTask();
      const result = pocketBaseToTaskRecord(pb, existingLocal);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('task-123');
      expect(result!.title).toBe('Test Task');
      expect(result!.dueDate).toBe('2026-04-10T12:00:00.000Z');
      expect(result!.createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result!.updatedAt).toBe('2026-04-08T10:00:00.000Z');
      expect(result!.notificationEnabled).toBe(true);
      expect(result!.notificationSent).toBe(false);
      expect(result!.notifyBefore).toBe(15);
      expect(result!.lastNotificationAt).toBe('2026-04-08T09:45:00.000Z');
      expect(result!.estimatedMinutes).toBe(30);
      expect(result!.timeSpent).toBe(10);
      expect(result!.snoozedUntil).toBe('2026-04-10T11:30:00.000Z');
    });

    it('should convert empty strings to undefined for optional date fields', () => {
      const pb = buildPBRecord({ due_date: '', completed_at: '' });
      const result = pocketBaseToTaskRecord(pb);

      expect(result).not.toBeNull();
      expect(result!.dueDate).toBeUndefined();
      expect(result!.completedAt).toBeUndefined();
    });

    it('should convert null numeric fields to undefined', () => {
      const pb = buildPBRecord({ notify_before: null, estimated_minutes: null });
      const result = pocketBaseToTaskRecord(pb);

      expect(result).not.toBeNull();
      expect(result!.notifyBefore).toBeUndefined();
      expect(result!.estimatedMinutes).toBeUndefined();
    });

    it('should preserve device-local notification state from existing local task', () => {
      const existingLocal = buildLocalTask({
        notificationSent: true,
        lastNotificationAt: '2026-04-08T10:30:00.000Z',
        snoozedUntil: '2026-04-10T12:00:00.000Z',
      });
      const result = pocketBaseToTaskRecord(buildPBRecord(), existingLocal);
      expect(result!.notificationSent).toBe(true);
      expect(result!.lastNotificationAt).toBe('2026-04-08T10:30:00.000Z');
      expect(result!.snoozedUntil).toBe('2026-04-10T12:00:00.000Z');
    });

    it('should default notification state when no existing local task', () => {
      const result = pocketBaseToTaskRecord(buildPBRecord());
      expect(result!.notificationSent).toBe(false);
      expect(result!.lastNotificationAt).toBeUndefined();
      expect(result!.snoozedUntil).toBeUndefined();
    });

    it('should return null for records missing required fields', () => {
      const pb = buildPBRecord({ task_id: '', title: '' });
      const result = pocketBaseToTaskRecord(pb);
      expect(result).toBeNull();
    });

    it('should return null for records with invalid quadrant', () => {
      const pb = buildPBRecord({ quadrant: 'invalid-quadrant' });
      const result = pocketBaseToTaskRecord(pb);
      expect(result).toBeNull();
    });

    it('should log the Zod issues under the validationErrors key so Sentry forwarding keeps them', () => {
      mockLogger.error.mockClear();
      const pb = buildPBRecord({ quadrant: 'invalid-quadrant' });
      pocketBaseToTaskRecord(pb);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [, , metadata] = mockLogger.error.mock.calls[0]!;
      expect(metadata).toHaveProperty('validationErrors');
      expect(metadata.validationErrors).toContain('quadrant');
      expect(metadata).not.toHaveProperty('errors');
    });

    it('should strip unknown fields from PB record', () => {
      const pb = buildPBRecord({ extra_field: 'should be ignored', another: 123 });
      const result = pocketBaseToTaskRecord(pb);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('task-123');
    });

    describe('length and count constraints (defense-in-depth)', () => {
      it('should skip a record whose title exceeds TASK_TITLE_MAX_LENGTH', () => {
        const pb = buildPBRecord({ title: 'a'.repeat(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH + 1) });
        expect(pocketBaseToTaskRecord(pb)).toBeNull();
      });

      it('should skip a record whose description exceeds TASK_DESCRIPTION_MAX_LENGTH', () => {
        const pb = buildPBRecord({ description: 'a'.repeat(SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH + 1) });
        expect(pocketBaseToTaskRecord(pb)).toBeNull();
      });

      it('should skip a record with more than MAX_TAGS tags', () => {
        const pb = buildPBRecord({
          tags: Array.from({ length: SCHEMA_LIMITS.MAX_TAGS + 1 }, (_, i) => `tag${i}`),
        });
        expect(pocketBaseToTaskRecord(pb)).toBeNull();
      });

      it('should skip a record with a single tag longer than TAG_MAX_LENGTH', () => {
        const pb = buildPBRecord({ tags: ['a'.repeat(SCHEMA_LIMITS.TAG_MAX_LENGTH + 1)] });
        expect(pocketBaseToTaskRecord(pb)).toBeNull();
      });

      it('should skip a record with more than MAX_SUBTASKS subtasks', () => {
        const pb = buildPBRecord({
          subtasks: Array.from({ length: SCHEMA_LIMITS.MAX_SUBTASKS + 1 }, (_, i) => ({
            id: `sub-${i}`,
            title: `Subtask ${i}`,
            completed: false,
          })),
        });
        expect(pocketBaseToTaskRecord(pb)).toBeNull();
      });

      it('should skip a record with a subtask title longer than SUBTASK_TITLE_MAX_LENGTH', () => {
        const pb = buildPBRecord({
          subtasks: [{ id: 'sub-1', title: 'a'.repeat(SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH + 1), completed: false }],
        });
        expect(pocketBaseToTaskRecord(pb)).toBeNull();
      });

      it('should accept a record sized exactly at the limits', () => {
        const pb = buildPBRecord({
          title: 'a'.repeat(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH),
          description: 'a'.repeat(SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH),
          tags: Array.from({ length: SCHEMA_LIMITS.MAX_TAGS }, (_, i) => `tag${i}`),
          subtasks: Array.from({ length: SCHEMA_LIMITS.MAX_SUBTASKS }, (_, i) => ({
            id: `sub-${i}`,
            title: 'Subtask',
            completed: false,
          })),
        });
        expect(pocketBaseToTaskRecord(pb)).not.toBeNull();
      });
    });

    it('should apply defaults for missing optional fields', () => {
      const pb = buildPBRecord();
      // Remove optional array fields to test defaults
      delete (pb as Record<string, unknown>).tags;
      delete (pb as Record<string, unknown>).subtasks;
      delete (pb as Record<string, unknown>).dependencies;
      delete (pb as Record<string, unknown>).time_entries;

      const result = pocketBaseToTaskRecord(pb);
      expect(result).not.toBeNull();
      expect(result!.tags).toEqual([]);
      expect(result!.subtasks).toEqual([]);
      expect(result!.dependencies).toEqual([]);
      expect(result!.timeEntries).toEqual([]);
    });
  });

  describe('client_updated_at clamping (LWW poisoning guard)', () => {
    // `client_updated_at` is the LWW authority and comes from the writing
    // device's own (unverifiable) clock. A skewed/forged far-future value would
    // permanently win every comparison and lock the task from other devices, so
    // the mapper caps it to now + a small skew window at the ingestion boundary.
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-17T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should_clamp_a_far_future_client_updated_at_to_now_plus_skew_window', () => {
      const pb = buildPBRecord({ client_updated_at: '2099-01-01T00:00:00.000Z' });
      const result = pocketBaseToTaskRecord(pb);
      expect(result).not.toBeNull();
      // now (12:00:00) + 5 min skew ceiling
      expect(result!.updatedAt).toBe('2026-07-17T12:05:00.000Z');
    });

    it('should_leave_a_normal_past_client_updated_at_unchanged', () => {
      const pb = buildPBRecord({ client_updated_at: '2026-07-10T09:00:00.000Z' });
      const result = pocketBaseToTaskRecord(pb);
      expect(result!.updatedAt).toBe('2026-07-10T09:00:00.000Z');
    });

    it('should_leave_a_near_now_client_updated_at_within_the_skew_window_unchanged', () => {
      // 2 minutes ahead — within tolerated inter-device skew, must not be clamped.
      const pb = buildPBRecord({ client_updated_at: '2026-07-17T12:02:00.000Z' });
      const result = pocketBaseToTaskRecord(pb);
      expect(result!.updatedAt).toBe('2026-07-17T12:02:00.000Z');
    });
  });

  describe('round-trip', () => {
    it('should preserve data through local → PB → local conversion', () => {
      const original = buildLocalTask();
      const pb = taskRecordToPocketBase(original, 'user-1', 'device-1');

      // Simulate a PB record with system fields added
      const pbRecord = {
        id: 'pb-id',
        collectionId: 'tasks',
        collectionName: 'tasks',
        created: '2026-04-01',
        updated: '2026-04-08',
        ...pb,
      };

      const roundTripped = pocketBaseToTaskRecord(pbRecord);
      expect(roundTripped).not.toBeNull();
      expect(roundTripped!.id).toBe(original.id);
      expect(roundTripped!.title).toBe(original.title);
      expect(roundTripped!.urgent).toBe(original.urgent);
      expect(roundTripped!.important).toBe(original.important);
      expect(roundTripped!.quadrant).toBe(original.quadrant);
      expect(roundTripped!.tags).toEqual(original.tags);
      expect(roundTripped!.subtasks).toEqual(original.subtasks);
      expect(roundTripped!.dependencies).toEqual(original.dependencies);
    });
  });
});
