import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getStreakData } from '@/lib/analytics/streaks';
import type { TaskRecord } from '@/lib/types';

describe('Streak Calculation', () => {
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
    // Mock current date to 2025-01-15
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getStreakData', () => {
    it('should return zero streak for no completed tasks', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: false },
        { ...baseTask, id: '2', completed: false },
      ];

      const streak = getStreakData(tasks);

      expect(streak.current).toBe(0);
      expect(streak.longest).toBe(0);
      expect(streak.lastCompletionDate).toBeNull();
    });

    it('should return zero streak for empty task list', () => {
      const streak = getStreakData([]);

      expect(streak.current).toBe(0);
      expect(streak.longest).toBe(0);
      expect(streak.lastCompletionDate).toBeNull();
    });

    it('should calculate current streak of 1 for task completed today', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: true, updatedAt: '2025-01-15T10:00:00Z' },
      ];

      const streak = getStreakData(tasks);

      expect(streak.current).toBe(1);
      expect(streak.longest).toBe(1);
      expect(streak.lastCompletionDate).toBe('2025-01-15');
    });

    it('should calculate consecutive day streak', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: true, updatedAt: '2025-01-15T10:00:00Z' }, // Today
        { ...baseTask, id: '2', completed: true, updatedAt: '2025-01-14T10:00:00Z' }, // Yesterday
        { ...baseTask, id: '3', completed: true, updatedAt: '2025-01-13T10:00:00Z' }, // 2 days ago
      ];

      const streak = getStreakData(tasks);

      expect(streak.current).toBe(3);
      expect(streak.longest).toBe(3);
    });

    it('should break streak when day is missed', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: true, updatedAt: '2025-01-15T10:00:00Z' }, // Today
        { ...baseTask, id: '2', completed: true, updatedAt: '2025-01-14T10:00:00Z' }, // Yesterday
        // Skip 2025-01-13 (streak broken)
        { ...baseTask, id: '3', completed: true, updatedAt: '2025-01-12T10:00:00Z' },
      ];

      const streak = getStreakData(tasks);

      expect(streak.current).toBe(2); // Only today and yesterday
    });

    it('should calculate longest streak even if not current', () => {
      const tasks: TaskRecord[] = [
        // Current streak: 1 (only today)
        { ...baseTask, id: '1', completed: true, updatedAt: '2025-01-15T10:00:00Z' },
        // Gap
        // Previous streak: 3 days
        { ...baseTask, id: '2', completed: true, updatedAt: '2025-01-10T10:00:00Z' },
        { ...baseTask, id: '3', completed: true, updatedAt: '2025-01-09T10:00:00Z' },
        { ...baseTask, id: '4', completed: true, updatedAt: '2025-01-08T10:00:00Z' },
      ];

      const streak = getStreakData(tasks);

      expect(streak.current).toBe(1);
      expect(streak.longest).toBe(3);
    });

    it('should handle multiple tasks completed on same day', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: true, updatedAt: '2025-01-15T09:00:00Z' }, // Today - morning
        { ...baseTask, id: '2', completed: true, updatedAt: '2025-01-15T14:00:00Z' }, // Today - afternoon
        { ...baseTask, id: '3', completed: true, updatedAt: '2025-01-14T10:00:00Z' }, // Yesterday
      ];

      const streak = getStreakData(tasks);

      expect(streak.current).toBe(2); // Should count as 2 days, not 3
    });

    it('should return zero current streak if no recent completions', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: true, updatedAt: '2025-01-10T10:00:00Z' }, // 5 days ago
        { ...baseTask, id: '2', completed: true, updatedAt: '2025-01-09T10:00:00Z' }, // 6 days ago
      ];

      const streak = getStreakData(tasks);

      expect(streak.current).toBe(0);
      expect(streak.longest).toBe(2);
    });
  });
});
