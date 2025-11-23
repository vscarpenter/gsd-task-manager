import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCompletionTrend, getRecurrenceBreakdown } from '@/lib/analytics/trends';
import type { TaskRecord } from '@/lib/types';

describe('Analytics Trends', () => {
  const baseTask: TaskRecord = {
    id: '1',
    title: 'Test Task',
    description: '',
    urgent: true,
    important: true,
    quadrant: 'urgent-important',
    completed: false,
    dueDate: undefined,
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2025-01-01T10:00:00Z',
    vectorClock: { device1: 1 },
    notifyBefore: 15,
    notificationEnabled: true,
  };

  beforeEach(() => {
    // Fix current time to 2025-01-15 12:00:00
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCompletionTrend', () => {
    it('should return trend data for requested number of days', () => {
      const tasks: TaskRecord[] = [];
      const trend = getCompletionTrend(tasks, 7);

      expect(trend).toHaveLength(7);
      trend.forEach(point => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('completed');
        expect(point).toHaveProperty('created');
      });
    });

    it('should return zero counts for empty task list', () => {
      const trend = getCompletionTrend([], 7);

      trend.forEach(point => {
        expect(point.completed).toBe(0);
        expect(point.created).toBe(0);
      });
    });

    it('should count completed tasks correctly', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: true, updatedAt: '2025-01-14T10:00:00Z' }, // Yesterday
        { ...baseTask, id: '2', completed: true, updatedAt: '2025-01-14T15:00:00Z' }, // Yesterday
        { ...baseTask, id: '3', completed: true, updatedAt: '2025-01-13T10:00:00Z' }, // 2 days ago
      ];

      const trend = getCompletionTrend(tasks, 3);

      // Find the data points
      const yesterday = trend.find(t => t.date === '2025-01-14');
      const twoDaysAgo = trend.find(t => t.date === '2025-01-13');

      expect(yesterday?.completed).toBe(2);
      expect(twoDaysAgo?.completed).toBe(1);
    });

    it('should count created tasks correctly', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', createdAt: '2025-01-14T10:00:00Z' }, // Yesterday
        { ...baseTask, id: '2', createdAt: '2025-01-14T15:00:00Z' }, // Yesterday
        { ...baseTask, id: '3', createdAt: '2025-01-13T10:00:00Z' }, // 2 days ago
      ];

      const trend = getCompletionTrend(tasks, 3);

      const yesterday = trend.find(t => t.date === '2025-01-14');
      const twoDaysAgo = trend.find(t => t.date === '2025-01-13');

      expect(yesterday?.created).toBe(2);
      expect(twoDaysAgo?.created).toBe(1);
    });

    it('should return dates in chronological order (oldest first)', () => {
      const trend = getCompletionTrend([], 3);

      expect(trend[0].date).toBe('2025-01-13'); // 2 days ago
      expect(trend[1].date).toBe('2025-01-14'); // Yesterday
      expect(trend[2].date).toBe('2025-01-15'); // Today
    });

    it('should handle 30-day trend', () => {
      const trend = getCompletionTrend([], 30);

      expect(trend).toHaveLength(30);
      expect(trend[0].date).toBe('2024-12-17'); // 30 days ago
      expect(trend[29].date).toBe('2025-01-15'); // Today
    });
  });

  describe('getRecurrenceBreakdown', () => {
    it('should return zero counts for empty task list', () => {
      const breakdown = getRecurrenceBreakdown([]);

      expect(breakdown).toEqual({
        none: 0,
        daily: 0,
        weekly: 0,
        monthly: 0,
      });
    });

    it('should count tasks by recurrence type', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', recurrence: 'none', completed: false },
        { ...baseTask, id: '2', recurrence: 'none', completed: false },
        { ...baseTask, id: '3', recurrence: 'daily', completed: false },
        { ...baseTask, id: '4', recurrence: 'weekly', completed: false },
        { ...baseTask, id: '5', recurrence: 'monthly', completed: false },
      ];

      const breakdown = getRecurrenceBreakdown(tasks);

      expect(breakdown).toEqual({
        none: 2,
        daily: 1,
        weekly: 1,
        monthly: 1,
      });
    });

    it('should exclude completed tasks from breakdown', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', recurrence: 'daily', completed: true },
        { ...baseTask, id: '2', recurrence: 'daily', completed: false },
        { ...baseTask, id: '3', recurrence: 'weekly', completed: true },
      ];

      const breakdown = getRecurrenceBreakdown(tasks);

      expect(breakdown).toEqual({
        none: 0,
        daily: 1, // Only uncompleted daily task
        weekly: 0, // Weekly task is completed
        monthly: 0,
      });
    });
  });
});
