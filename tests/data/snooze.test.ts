import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { snoozeTask, clearSnooze, isTaskSnoozed, getRemainingSnoozeMinutes } from '@/lib/tasks/crud/snooze';
import { TIME_TRACKING } from '@/lib/constants';
import type { TaskRecord } from '@/lib/types';
import { getDb } from '@/lib/db';

// Mock dependencies
const mockPut = vi.fn();
const mockGet = vi.fn();
const mockEnqueue = vi.fn();

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    tasks: {
      get: mockGet,
      put: mockPut,
    },
  })),
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => ({
    enqueue: mockEnqueue,
  })),
}));

vi.mock('@/lib/sync/config', () => ({
  getSyncConfig: vi.fn(async () => ({
    enabled: false,
    deviceId: 'test-device',
  })),
}));

vi.mock('@/lib/sync/background-sync', () => ({
  getBackgroundSyncManager: vi.fn(() => ({
    isRunning: vi.fn(() => false),
    scheduleDebouncedSync: vi.fn(),
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Snooze Functionality', () => {
  const baseTask: TaskRecord = {
    id: 'test-task-1',
    title: 'Test Task',
    description: '',
    urgent: true,
    important: true,
    quadrant: 'urgent-important',
    completed: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notifyBefore: 15,
    notificationEnabled: true,
    notificationSent: false,
    vectorClock: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
    mockGet.mockResolvedValue({ ...baseTask });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('snoozeTask', () => {
    it('throws error for negative minutes', async () => {
      await expect(snoozeTask('test-task-1', -5)).rejects.toThrow(
        'Snooze duration cannot be negative'
      );
    });

    it('throws error for minutes exceeding MAX_SNOOZE_MINUTES', async () => {
      const excessiveMinutes = TIME_TRACKING.MAX_SNOOZE_MINUTES + 1;
      await expect(snoozeTask('test-task-1', excessiveMinutes)).rejects.toThrow(
        `Snooze duration cannot exceed ${TIME_TRACKING.MAX_SNOOZE_MINUTES} minutes`
      );
    });

    it('allows maximum snooze duration', async () => {
      await snoozeTask('test-task-1', TIME_TRACKING.MAX_SNOOZE_MINUTES);
      expect(mockPut).toHaveBeenCalled();
    });

    it('sets snoozedUntil correctly for valid duration', async () => {
      await snoozeTask('test-task-1', 60);

      expect(mockPut).toHaveBeenCalled();
      const savedTask = mockPut.mock.calls[0][0];

      // Should be 1 hour from now
      const expectedTime = new Date('2025-01-01T13:00:00Z').toISOString();
      expect(savedTask.snoozedUntil).toBe(expectedTime);
    });

    it('clears snooze when minutes is 0', async () => {
      await snoozeTask('test-task-1', 0);

      expect(mockPut).toHaveBeenCalled();
      const savedTask = mockPut.mock.calls[0][0];
      expect(savedTask.snoozedUntil).toBeUndefined();
    });

    it('throws error when task not found', async () => {
      mockGet.mockResolvedValue(undefined);

      await expect(snoozeTask('nonexistent', 30)).rejects.toThrow(
        'Task nonexistent not found'
      );
    });
  });

  describe('clearSnooze', () => {
    it('calls snoozeTask with 0 minutes', async () => {
      await clearSnooze('test-task-1');

      expect(mockPut).toHaveBeenCalled();
      const savedTask = mockPut.mock.calls[0][0];
      expect(savedTask.snoozedUntil).toBeUndefined();
    });
  });

  describe('isTaskSnoozed', () => {
    it('returns false when snoozedUntil is undefined', () => {
      const task = { ...baseTask, snoozedUntil: undefined };
      expect(isTaskSnoozed(task)).toBe(false);
    });

    it('returns false when snooze has expired', () => {
      // Snooze ended 1 hour ago
      const task = { ...baseTask, snoozedUntil: '2025-01-01T11:00:00Z' };
      expect(isTaskSnoozed(task)).toBe(false);
    });

    it('returns true when snooze is active', () => {
      // Snooze ends 1 hour from now
      const task = { ...baseTask, snoozedUntil: '2025-01-01T13:00:00Z' };
      expect(isTaskSnoozed(task)).toBe(true);
    });
  });

  describe('getRemainingSnoozeMinutes', () => {
    it('returns 0 when snoozedUntil is undefined', () => {
      const task = { ...baseTask, snoozedUntil: undefined };
      expect(getRemainingSnoozeMinutes(task)).toBe(0);
    });

    it('returns 0 when snooze has expired', () => {
      const task = { ...baseTask, snoozedUntil: '2025-01-01T11:00:00Z' };
      expect(getRemainingSnoozeMinutes(task)).toBe(0);
    });

    it('calculates remaining minutes correctly', () => {
      // Snooze ends 30 minutes from now
      const task = { ...baseTask, snoozedUntil: '2025-01-01T12:30:00Z' };
      expect(getRemainingSnoozeMinutes(task)).toBe(30);
    });

    it('rounds up partial minutes', () => {
      // Snooze ends 30 minutes and 30 seconds from now
      const snoozedUntil = new Date('2025-01-01T12:30:30Z').toISOString();
      const task = { ...baseTask, snoozedUntil };
      expect(getRemainingSnoozeMinutes(task)).toBe(31); // Ceil to 31
    });
  });
});

describe('Snooze Duration Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('MAX_SNOOZE_MINUTES is approximately 1 year', () => {
    const oneYearInMinutes = 365 * 24 * 60;
    expect(TIME_TRACKING.MAX_SNOOZE_MINUTES).toBe(oneYearInMinutes);
  });

  it('common snooze durations are within limits', () => {
    const commonDurations = [
      15, // 15 minutes
      30, // 30 minutes
      60, // 1 hour
      180, // 3 hours
      TIME_TRACKING.MINUTES_PER_DAY, // Tomorrow
      TIME_TRACKING.MINUTES_PER_WEEK, // Next week
    ];

    commonDurations.forEach((duration) => {
      expect(duration).toBeLessThanOrEqual(TIME_TRACKING.MAX_SNOOZE_MINUTES);
    });
  });
});
