import { describe, it, expect } from 'vitest';
import {
  calculateTimeTrackingSummary,
  getTimeByQuadrant,
  getTimeComparisonData,
  formatDuration,
} from '@/lib/analytics/time-tracking';
import type { TaskRecord } from '@/lib/types';

const createTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-' + Math.random().toString(36).slice(2),
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
  ...overrides,
});

describe('calculateTimeTrackingSummary', () => {
  it('returns zero values for empty task list', () => {
    const summary = calculateTimeTrackingSummary([]);

    expect(summary.totalMinutesTracked).toBe(0);
    expect(summary.totalMinutesEstimated).toBe(0);
    expect(summary.tasksWithTimeTracking).toBe(0);
    expect(summary.tasksWithEstimates).toBe(0);
    expect(summary.tasksWithRunningTimers).toBe(0);
    expect(summary.estimationAccuracy).toBe(0);
    expect(summary.overEstimateTasks).toBe(0);
    expect(summary.underEstimateTasks).toBe(0);
  });

  it('counts tasks with time tracking', () => {
    const tasks = [
      createTask({ timeSpent: 30 }),
      createTask({ timeSpent: 60 }),
      createTask(), // No time spent
    ];

    const summary = calculateTimeTrackingSummary(tasks);

    expect(summary.tasksWithTimeTracking).toBe(2);
    expect(summary.totalMinutesTracked).toBe(90);
  });

  it('counts tasks with estimates', () => {
    const tasks = [
      createTask({ estimatedMinutes: 30 }),
      createTask({ estimatedMinutes: 60 }),
      createTask(), // No estimate
    ];

    const summary = calculateTimeTrackingSummary(tasks);

    expect(summary.tasksWithEstimates).toBe(2);
    expect(summary.totalMinutesEstimated).toBe(90);
  });

  it('counts running timers', () => {
    const tasks = [
      createTask({ timeEntries: [{ id: '1', startedAt: '2025-01-01T10:00:00Z' }] }), // Running
      createTask({
        timeEntries: [{ id: '2', startedAt: '2025-01-01T10:00:00Z', endedAt: '2025-01-01T11:00:00Z' }],
      }), // Stopped
      createTask(), // No entries
    ];

    const summary = calculateTimeTrackingSummary(tasks);

    expect(summary.tasksWithRunningTimers).toBe(1);
  });

  it('calculates estimation accuracy', () => {
    const tasks = [
      createTask({ estimatedMinutes: 60, timeSpent: 60 }), // 100% accuracy
      createTask({ estimatedMinutes: 60, timeSpent: 30 }), // 50% accuracy
    ];

    const summary = calculateTimeTrackingSummary(tasks);

    expect(summary.estimationAccuracy).toBe(75); // Average of 100 and 50
  });

  it('counts over and under estimates', () => {
    const tasks = [
      createTask({ estimatedMinutes: 30, timeSpent: 60 }), // Over estimate
      createTask({ estimatedMinutes: 60, timeSpent: 30 }), // Under estimate
      createTask({ estimatedMinutes: 60, timeSpent: 60 }), // Under (not over since equal)
    ];

    const summary = calculateTimeTrackingSummary(tasks);

    expect(summary.overEstimateTasks).toBe(1);
    expect(summary.underEstimateTasks).toBe(2);
  });
});

describe('getTimeByQuadrant', () => {
  it('returns all quadrants even if empty', () => {
    const distribution = getTimeByQuadrant([]);

    expect(distribution).toHaveLength(4);
    expect(distribution.map((d) => d.quadrantId)).toEqual([
      'urgent-important',
      'not-urgent-important',
      'urgent-not-important',
      'not-urgent-not-important',
    ]);
  });

  it('calculates time per quadrant', () => {
    const tasks = [
      createTask({ quadrant: 'urgent-important', timeSpent: 30 }),
      createTask({ quadrant: 'urgent-important', timeSpent: 60 }),
      createTask({ quadrant: 'not-urgent-important', timeSpent: 45 }),
    ];

    const distribution = getTimeByQuadrant(tasks);

    const q1 = distribution.find((d) => d.quadrantId === 'urgent-important')!;
    const q2 = distribution.find((d) => d.quadrantId === 'not-urgent-important')!;

    expect(q1.totalMinutes).toBe(90);
    expect(q1.taskCount).toBe(2);
    expect(q1.averageMinutesPerTask).toBe(45);

    expect(q2.totalMinutes).toBe(45);
    expect(q2.taskCount).toBe(1);
    expect(q2.averageMinutesPerTask).toBe(45);
  });

  it('ignores tasks with 0 time spent', () => {
    const tasks = [
      createTask({ quadrant: 'urgent-important', timeSpent: 30 }),
      createTask({ quadrant: 'urgent-important', timeSpent: 0 }),
    ];

    const distribution = getTimeByQuadrant(tasks);
    const q1 = distribution.find((d) => d.quadrantId === 'urgent-important')!;

    expect(q1.taskCount).toBe(1);
    expect(q1.totalMinutes).toBe(30);
  });
});

describe('getTimeComparisonData', () => {
  it('returns empty array for tasks without both estimate and time spent', () => {
    const tasks = [
      createTask({ estimatedMinutes: 30 }), // No time spent
      createTask({ timeSpent: 60 }), // No estimate
      createTask(), // Neither
    ];

    const comparisons = getTimeComparisonData(tasks);

    expect(comparisons).toHaveLength(0);
  });

  it('calculates accuracy for tasks with both values', () => {
    const tasks = [
      createTask({ id: 'task1', title: 'Task 1', estimatedMinutes: 60, timeSpent: 90 }),
      createTask({ id: 'task2', title: 'Task 2', estimatedMinutes: 60, timeSpent: 30 }),
    ];

    const comparisons = getTimeComparisonData(tasks);

    expect(comparisons).toHaveLength(2);

    const task1 = comparisons.find((c) => c.taskId === 'task1')!;
    expect(task1.accuracy).toBe(150); // 90/60 * 100 = 150%
    expect(task1.isOver).toBe(true);

    const task2 = comparisons.find((c) => c.taskId === 'task2')!;
    expect(task2.accuracy).toBe(50); // 30/60 * 100 = 50%
    expect(task2.isOver).toBe(false);
  });

  it('sorts by accuracy descending (most over first)', () => {
    const tasks = [
      createTask({ id: 'low', estimatedMinutes: 60, timeSpent: 30 }), // 50%
      createTask({ id: 'high', estimatedMinutes: 60, timeSpent: 120 }), // 200%
      createTask({ id: 'mid', estimatedMinutes: 60, timeSpent: 60 }), // 100%
    ];

    const comparisons = getTimeComparisonData(tasks);

    expect(comparisons[0].taskId).toBe('high');
    expect(comparisons[1].taskId).toBe('mid');
    expect(comparisons[2].taskId).toBe('low');
  });
});

describe('formatDuration', () => {
  it('returns "0m" for zero minutes', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats minutes correctly', () => {
    expect(formatDuration(1)).toBe('1m');
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(59)).toBe('59m');
  });

  it('formats hours correctly', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours and minutes correctly', () => {
    expect(formatDuration(61)).toBe('1h 1m');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(145)).toBe('2h 25m');
  });
});
