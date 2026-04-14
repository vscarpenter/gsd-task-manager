import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  formatTimeSpent,
  hasRunningTimer,
  getRunningEntry,
} from '@/lib/tasks/crud/time-tracking';
import { TIME_TRACKING } from '@/lib/constants';
import type { TaskRecord } from '@/lib/types';

// Hoisted mocks for async function tests
const mockGet = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());
const mockEnqueue = vi.hoisted(() => vi.fn());
const mockIsoNow = vi.hoisted(() => vi.fn(() => '2025-06-01T12:00:00.000Z'));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    tasks: { get: mockGet, put: mockPut },
  })),
}));

vi.mock('@/lib/tasks/crud/helpers', () => ({
  getSyncContext: vi.fn(async () => ({
    syncConfig: { enabled: false, deviceId: 'test-device' },
    deviceId: 'test-device',
  })),
  enqueueSyncOperation: (...args: unknown[]) => mockEnqueue(...args),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'abc12345'),
}));

vi.mock('@/lib/utils', () => ({
  isoNow: mockIsoNow,
}));

/** Reusable base task for async tests */
function createBaseTask(overrides?: Partial<TaskRecord>): TaskRecord {
  return {
    id: 'task-1',
    title: 'Test',
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
    notificationEnabled: false,
    notificationSent: false,
    timeEntries: [],
    ...overrides,
  };
}

describe('Time Tracking Utilities', () => {
  describe('formatTimeSpent', () => {
    it('returns "< 1m" for 0 minutes', () => {
      expect(formatTimeSpent(0)).toBe('< 1m');
    });

    it('formats minutes under 1 hour', () => {
      expect(formatTimeSpent(1)).toBe('1m');
      expect(formatTimeSpent(30)).toBe('30m');
      expect(formatTimeSpent(59)).toBe('59m');
    });

    it('formats exact hours', () => {
      expect(formatTimeSpent(60)).toBe('1h');
      expect(formatTimeSpent(120)).toBe('2h');
      expect(formatTimeSpent(TIME_TRACKING.MINUTES_PER_HOUR * 5)).toBe('5h');
    });

    it('formats hours and minutes', () => {
      expect(formatTimeSpent(61)).toBe('1h 1m');
      expect(formatTimeSpent(90)).toBe('1h 30m');
      expect(formatTimeSpent(125)).toBe('2h 5m');
    });
  });

  describe('hasRunningTimer', () => {
    it('returns false for task without timeEntries', () => {
      const task = { timeEntries: undefined } as TaskRecord;
      expect(hasRunningTimer(task)).toBe(false);
    });

    it('returns false for task with empty timeEntries', () => {
      const task = { timeEntries: [] } as TaskRecord;
      expect(hasRunningTimer(task)).toBe(false);
    });

    it('returns false for task with all completed entries', () => {
      const task = {
        timeEntries: [
          { id: '1', startedAt: '2025-01-01T10:00:00Z', endedAt: '2025-01-01T11:00:00Z' },
        ],
      } as TaskRecord;
      expect(hasRunningTimer(task)).toBe(false);
    });

    it('returns true for task with running entry', () => {
      const task = {
        timeEntries: [
          { id: '1', startedAt: '2025-01-01T10:00:00Z' }, // No endedAt = running
        ],
      } as TaskRecord;
      expect(hasRunningTimer(task)).toBe(true);
    });
  });

  describe('getRunningEntry', () => {
    it('returns undefined for task without running entries', () => {
      const task = {
        timeEntries: [
          { id: '1', startedAt: '2025-01-01T10:00:00Z', endedAt: '2025-01-01T11:00:00Z' },
        ],
      } as TaskRecord;
      expect(getRunningEntry(task)).toBeUndefined();
    });

    it('returns the running entry', () => {
      const runningEntry = { id: '2', startedAt: '2025-01-01T12:00:00Z' };
      const task = {
        timeEntries: [
          { id: '1', startedAt: '2025-01-01T10:00:00Z', endedAt: '2025-01-01T11:00:00Z' },
          runningEntry,
        ],
      } as TaskRecord;
      expect(getRunningEntry(task)).toEqual(runningEntry);
    });
  });
});

describe('startTimeTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsoNow.mockReturnValue('2025-06-01T12:00:00.000Z');
  });

  it('creates a new time entry on a task', async () => {
    const { startTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    const task = createBaseTask();
    mockGet.mockResolvedValue(task);
    mockPut.mockResolvedValue(undefined);

    const result = await startTimeTracking('task-1');

    expect(mockPut).toHaveBeenCalledOnce();
    expect(result.timeEntries).toHaveLength(1);
    expect(result.timeEntries![0]).toMatchObject({
      id: 'abc12345',
      startedAt: '2025-06-01T12:00:00.000Z',
    });
    expect(result.timeEntries![0].endedAt).toBeUndefined();
  });

  it('throws when task not found', async () => {
    const { startTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    mockGet.mockResolvedValue(undefined);

    await expect(startTimeTracking('nonexistent')).rejects.toThrow(
      'Task nonexistent not found'
    );
  });

  it('throws when timer already running', async () => {
    const { startTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    const task = createBaseTask({
      timeEntries: [{ id: 'entry-1', startedAt: '2025-06-01T10:00:00.000Z' }],
    });
    mockGet.mockResolvedValue(task);

    await expect(startTimeTracking('task-1')).rejects.toThrow(
      'Task already has a running timer'
    );
  });
});

describe('stopTimeTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsoNow.mockReturnValue('2025-06-01T13:00:00.000Z');
  });

  it('stops running timer and calculates timeSpent', async () => {
    const { stopTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    const task = createBaseTask({
      timeEntries: [{ id: 'entry-1', startedAt: '2025-06-01T12:00:00.000Z' }],
    });
    mockGet.mockResolvedValue(task);
    mockPut.mockResolvedValue(undefined);

    const result = await stopTimeTracking('task-1', 'test notes');

    expect(mockPut).toHaveBeenCalledOnce();
    expect(result.timeEntries).toHaveLength(1);
    expect(result.timeEntries![0].endedAt).toBe('2025-06-01T13:00:00.000Z');
    expect(result.timeEntries![0].notes).toBe('test notes');
    // 1 hour = 60 minutes
    expect(result.timeSpent).toBe(60);
  });

  it('throws when no running timer', async () => {
    const { stopTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    const task = createBaseTask({
      timeEntries: [
        {
          id: 'entry-1',
          startedAt: '2025-06-01T10:00:00.000Z',
          endedAt: '2025-06-01T11:00:00.000Z',
        },
      ],
    });
    mockGet.mockResolvedValue(task);

    await expect(stopTimeTracking('task-1')).rejects.toThrow(
      'No running timer found for this task'
    );
  });

  it('throws when task not found', async () => {
    const { stopTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    mockGet.mockResolvedValue(undefined);

    await expect(stopTimeTracking('missing-task')).rejects.toThrow(
      'Task missing-task not found'
    );
  });

  it('accumulates timeSpent correctly across multiple completed entries', async () => {
    const { stopTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    // Two completed entries totalling 90 min, plus one running entry of 30 min
    const task = createBaseTask({
      timeSpent: 90,
      timeEntries: [
        {
          id: 'entry-1',
          startedAt: '2025-06-01T08:00:00.000Z',
          endedAt: '2025-06-01T09:00:00.000Z', // 60 min
        },
        {
          id: 'entry-2',
          startedAt: '2025-06-01T10:00:00.000Z',
          endedAt: '2025-06-01T10:30:00.000Z', // 30 min
        },
        {
          id: 'entry-3',
          startedAt: '2025-06-01T12:00:00.000Z', // running
        },
      ],
    });
    mockGet.mockResolvedValue(task);
    mockIsoNow.mockReturnValue('2025-06-01T12:15:00.000Z'); // 15 min later
    mockPut.mockResolvedValue(undefined);

    const result = await stopTimeTracking('task-1');

    // 60 + 30 + 15 = 105 minutes total
    expect(result.timeSpent).toBe(105);
    expect(result.timeEntries).toHaveLength(3);
    expect(result.timeEntries![2].endedAt).toBe('2025-06-01T12:15:00.000Z');
  });

  it('preserves existing entry notes when stop called without notes argument', async () => {
    const { stopTimeTracking } = await import('@/lib/tasks/crud/time-tracking');

    const existingNotes = 'pre-existing session notes';
    const task = createBaseTask({
      timeEntries: [
        {
          id: 'entry-1',
          startedAt: '2025-06-01T12:00:00.000Z',
          notes: existingNotes,
        },
      ],
    });
    mockGet.mockResolvedValue(task);
    mockPut.mockResolvedValue(undefined);

    const result = await stopTimeTracking('task-1'); // no notes arg

    expect(result.timeEntries![0].notes).toBe(existingNotes);
  });
});

describe('TIME_TRACKING Constants', () => {
  it('has correct MS_PER_MINUTE value', () => {
    expect(TIME_TRACKING.MS_PER_MINUTE).toBe(60000);
  });

  it('has correct MINUTES_PER_HOUR value', () => {
    expect(TIME_TRACKING.MINUTES_PER_HOUR).toBe(60);
  });

  it('has correct MINUTES_PER_DAY value', () => {
    expect(TIME_TRACKING.MINUTES_PER_DAY).toBe(24 * 60);
  });

  it('has correct MINUTES_PER_WEEK value', () => {
    expect(TIME_TRACKING.MINUTES_PER_WEEK).toBe(7 * 24 * 60);
  });

  it('has MAX_SNOOZE_MINUTES set to approximately 1 year', () => {
    expect(TIME_TRACKING.MAX_SNOOZE_MINUTES).toBe(365 * 24 * 60);
  });

  it('has correct SECONDS constants', () => {
    expect(TIME_TRACKING.SECONDS_PER_MINUTE).toBe(60);
    expect(TIME_TRACKING.SECONDS_PER_HOUR).toBe(3600);
  });
});
