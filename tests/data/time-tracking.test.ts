import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  formatTimeSpent,
  hasRunningTimer,
  getRunningEntry,
} from '@/lib/tasks/crud/time-tracking';
import { TIME_TRACKING } from '@/lib/constants';
import type { TaskRecord } from '@/lib/types';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

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
