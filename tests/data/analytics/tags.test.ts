import { describe, it, expect } from 'vitest';
import { calculateTagStatistics } from '@/lib/analytics/tags';
import type { TaskRecord } from '@/lib/types';

describe('Tag Analytics', () => {
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

  describe('calculateTagStatistics', () => {
    it('should return empty array for tasks with no tags', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', tags: [] },
        { ...baseTask, id: '2', tags: [] },
      ];

      const stats = calculateTagStatistics(tasks);

      expect(stats).toEqual([]);
    });

    it('should calculate statistics for single tag', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', tags: ['work'], completed: true },
        { ...baseTask, id: '2', tags: ['work'], completed: false },
        { ...baseTask, id: '3', tags: ['work'], completed: true },
      ];

      const stats = calculateTagStatistics(tasks);

      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        tag: 'work',
        count: 3,
        completedCount: 2,
        completionRate: 67,
      });
    });

    it('should calculate statistics for multiple tags', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', tags: ['work'], completed: true },
        { ...baseTask, id: '2', tags: ['personal'], completed: false },
        { ...baseTask, id: '3', tags: ['health'], completed: true },
      ];

      const stats = calculateTagStatistics(tasks);

      expect(stats).toHaveLength(3);
      expect(stats.some(s => s.tag === 'work')).toBe(true);
      expect(stats.some(s => s.tag === 'personal')).toBe(true);
      expect(stats.some(s => s.tag === 'health')).toBe(true);
    });

    it('should handle tasks with multiple tags', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', tags: ['work', 'urgent'], completed: true },
        { ...baseTask, id: '2', tags: ['work'], completed: false },
      ];

      const stats = calculateTagStatistics(tasks);

      const workStats = stats.find(s => s.tag === 'work');
      const urgentStats = stats.find(s => s.tag === 'urgent');

      expect(workStats).toEqual({
        tag: 'work',
        count: 2,
        completedCount: 1,
        completionRate: 50,
      });

      expect(urgentStats).toEqual({
        tag: 'urgent',
        count: 1,
        completedCount: 1,
        completionRate: 100,
      });
    });

    it('should calculate 0% completion rate correctly', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', tags: ['work'], completed: false },
        { ...baseTask, id: '2', tags: ['work'], completed: false },
      ];

      const stats = calculateTagStatistics(tasks);

      expect(stats[0].completionRate).toBe(0);
    });

    it('should calculate 100% completion rate correctly', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', tags: ['work'], completed: true },
        { ...baseTask, id: '2', tags: ['work'], completed: true },
      ];

      const stats = calculateTagStatistics(tasks);

      expect(stats[0].completionRate).toBe(100);
    });

    it('should sort tags by count in descending order', () => {
      const tasks: TaskRecord[] = [
        { ...baseTask, id: '1', tags: ['work'], completed: false },
        { ...baseTask, id: '2', tags: ['work'], completed: false },
        { ...baseTask, id: '3', tags: ['work'], completed: false },
        { ...baseTask, id: '4', tags: ['personal'], completed: false },
        { ...baseTask, id: '5', tags: ['personal'], completed: false },
        { ...baseTask, id: '6', tags: ['health'], completed: false },
      ];

      const stats = calculateTagStatistics(tasks);

      expect(stats[0].tag).toBe('work');
      expect(stats[0].count).toBe(3);
      expect(stats[1].tag).toBe('personal');
      expect(stats[1].count).toBe(2);
      expect(stats[2].tag).toBe('health');
      expect(stats[2].count).toBe(1);
    });
  });
});
