import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateMetrics, getQuadrantPerformance } from '@/lib/analytics/metrics';
import type { TaskRecord } from '@/lib/types';

// Mock date-fns to control time
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    // Use fixed date for testing: 2025-01-15 12:00:00
    startOfDay: (date: Date) => new Date('2025-01-15T00:00:00Z'),
    startOfWeek: (date: Date) => new Date('2025-01-12T00:00:00Z'),
    startOfMonth: (date: Date) => new Date('2025-01-01T00:00:00Z'),
  };
});

describe('Analytics Metrics', () => {
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

  describe('calculateMetrics', () => {
    it('should return zero metrics for empty task list', () => {
      const metrics = calculateMetrics([]);

      expect(metrics.totalTasks).toBe(0);
      expect(metrics.activeTasks).toBe(0);
      expect(metrics.completedTasks).toBe(0);
      expect(metrics.completionRate).toBe(0);
      expect(metrics.completedToday).toBe(0);
      expect(metrics.activeStreak).toBe(0);
      expect(metrics.longestStreak).toBe(0);
    });

    it('should calculate correct task counts', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: false },
        { ...baseTask, id: '2', completed: true },
        { ...baseTask, id: '3', completed: true },
        { ...baseTask, id: '4', completed: false },
      ];

      const metrics = calculateMetrics(tasks);

      expect(metrics.totalTasks).toBe(4);
      expect(metrics.activeTasks).toBe(2);
      expect(metrics.completedTasks).toBe(2);
    });

    it('should calculate completion rate correctly', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: false },
        { ...baseTask, id: '2', completed: true },
        { ...baseTask, id: '3', completed: true },
        { ...baseTask, id: '4', completed: false },
      ];

      const metrics = calculateMetrics(tasks);

      expect(metrics.completionRate).toBe(50);
    });

    it('should calculate completion rate as 100 for all completed', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', completed: true },
        { ...baseTask, id: '2', completed: true },
      ];

      const metrics = calculateMetrics(tasks);

      expect(metrics.completionRate).toBe(100);
    });

    it('should build quadrant distribution for active tasks', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', urgent: true, important: true, quadrant: 'urgent-important', completed: false },
        { ...baseTask, id: '2', urgent: true, important: true, quadrant: 'urgent-important', completed: false },
        { ...baseTask, id: '3', urgent: false, important: true, quadrant: 'not-urgent-important', completed: false },
        { ...baseTask, id: '4', urgent: true, important: false, quadrant: 'urgent-not-important', completed: false },
        { ...baseTask, id: '5', urgent: false, important: false, quadrant: 'not-urgent-not-important', completed: false },
        { ...baseTask, id: '6', completed: true }, // Should not be counted
      ];

      const metrics = calculateMetrics(tasks);

      expect(metrics.quadrantDistribution).toEqual({
        'urgent-important': 2,
        'not-urgent-important': 1,
        'urgent-not-important': 1,
        'not-urgent-not-important': 1,
      });
    });

    it('should count overdue tasks correctly', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', dueDate: '2025-01-10T10:00:00Z', completed: false }, // Overdue
        { ...baseTask, id: '2', dueDate: '2025-01-20T10:00:00Z', completed: false }, // Not overdue
        { ...baseTask, id: '3', completed: false }, // No due date
      ];

      const metrics = calculateMetrics(tasks);

      expect(metrics.overdueCount).toBe(1);
    });

    it('should count tasks with no due date', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', dueDate: undefined, completed: false },
        { ...baseTask, id: '2', dueDate: '2025-01-20T10:00:00Z', completed: false },
        { ...baseTask, id: '3', dueDate: undefined, completed: false },
      ];

      const metrics = calculateMetrics(tasks);

      expect(metrics.noDueDateCount).toBe(2);
    });
  });

  describe('getQuadrantPerformance', () => {
    it('should return performance for all quadrants', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', quadrant: 'urgent-important', completed: true },
        { ...baseTask, id: '2', quadrant: 'urgent-important', completed: false },
        { ...baseTask, id: '3', quadrant: 'not-urgent-important', completed: true },
        { ...baseTask, id: '4', quadrant: 'not-urgent-important', completed: true },
      ];

      const performance = getQuadrantPerformance(tasks);

      expect(performance).toHaveLength(4);
      expect(performance[0].quadrantId).toBeDefined();
      expect(performance[0].completionRate).toBeGreaterThanOrEqual(0);
      expect(performance[0].totalTasks).toBeGreaterThanOrEqual(0);
    });

    it('should sort by completion rate descending', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', quadrant: 'urgent-important', completed: false }, // 0%
        { ...baseTask, id: '2', quadrant: 'urgent-important', completed: false },
        { ...baseTask, id: '3', quadrant: 'not-urgent-important', completed: true }, // 100%
      ];

      const performance = getQuadrantPerformance(tasks);

      // First item should have highest completion rate
      expect(performance[0].completionRate).toBeGreaterThanOrEqual(performance[1].completionRate);
      expect(performance[1].completionRate).toBeGreaterThanOrEqual(performance[2].completionRate);
    });

    it('should handle empty task list', () => {
      const performance = getQuadrantPerformance([]);

      expect(performance).toHaveLength(4);
      performance.forEach(perf => {
        expect(perf.completionRate).toBe(0);
        expect(perf.totalTasks).toBe(0);
      });
    });
  });
});
