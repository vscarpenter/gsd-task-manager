/**
 * Time tracking analytics
 *
 * Provides metrics and statistics for time tracking data:
 * - Total time spent across all tasks
 * - Estimated vs actual time comparisons
 * - Time spent per quadrant
 * - Tasks with running timers
 */

import type { TaskRecord, QuadrantId } from "@/lib/types";
import { TIME_TRACKING } from "@/lib/constants";
import { formatTimeSpent } from "@/lib/tasks/crud/time-tracking";

/** Summary of time tracking data */
export interface TimeTrackingSummary {
  /** Total minutes tracked across all tasks */
  totalMinutesTracked: number;
  /** Total minutes estimated across all tasks */
  totalMinutesEstimated: number;
  /** Number of tasks with time entries */
  tasksWithTimeTracking: number;
  /** Number of tasks with estimates */
  tasksWithEstimates: number;
  /** Number of tasks currently being tracked */
  tasksWithRunningTimers: number;
  /** Average accuracy (actual/estimated * 100) */
  estimationAccuracy: number;
  /** Tasks that exceeded their estimates */
  overEstimateTasks: number;
  /** Tasks completed under estimate */
  underEstimateTasks: number;
}

/** Time distribution by quadrant */
export interface QuadrantTimeDistribution {
  quadrantId: QuadrantId;
  totalMinutes: number;
  taskCount: number;
  averageMinutesPerTask: number;
}

/** Task time comparison for estimation accuracy */
export interface TaskTimeComparison {
  taskId: string;
  title: string;
  estimatedMinutes: number;
  actualMinutes: number;
  accuracy: number; // percentage: actual/estimated * 100
  isOver: boolean;
  isCompleted: boolean;
}

/**
 * Calculate overall time tracking summary
 */
export function calculateTimeTrackingSummary(tasks: TaskRecord[]): TimeTrackingSummary {
  let totalMinutesTracked = 0;
  let totalMinutesEstimated = 0;
  let tasksWithTimeTracking = 0;
  let tasksWithEstimates = 0;
  let tasksWithRunningTimers = 0;
  let overEstimateTasks = 0;
  let underEstimateTasks = 0;
  let accuracySum = 0;
  let accuracyCount = 0;

  for (const task of tasks) {
    const timeSpent = task.timeSpent || 0;
    const hasRunningTimer = task.timeEntries?.some(e => !e.endedAt) || false;

    if (timeSpent > 0 || hasRunningTimer) {
      tasksWithTimeTracking++;
      totalMinutesTracked += timeSpent;
    }

    if (hasRunningTimer) {
      tasksWithRunningTimers++;
    }

    if (task.estimatedMinutes) {
      tasksWithEstimates++;
      totalMinutesEstimated += task.estimatedMinutes;

      // Calculate estimation accuracy for tasks with both estimate and actual time
      if (timeSpent > 0) {
        const accuracy = (timeSpent / task.estimatedMinutes) * 100;
        accuracySum += accuracy;
        accuracyCount++;

        if (timeSpent > task.estimatedMinutes) {
          overEstimateTasks++;
        } else {
          underEstimateTasks++;
        }
      }
    }
  }

  return {
    totalMinutesTracked,
    totalMinutesEstimated,
    tasksWithTimeTracking,
    tasksWithEstimates,
    tasksWithRunningTimers,
    estimationAccuracy: accuracyCount > 0 ? Math.round(accuracySum / accuracyCount) : 0,
    overEstimateTasks,
    underEstimateTasks,
  };
}

/**
 * Get time distribution by quadrant
 */
export function getTimeByQuadrant(tasks: TaskRecord[]): QuadrantTimeDistribution[] {
  const quadrantMap = new Map<QuadrantId, { total: number; count: number }>();

  for (const task of tasks) {
    const timeSpent = task.timeSpent || 0;
    if (timeSpent > 0) {
      const existing = quadrantMap.get(task.quadrant) || { total: 0, count: 0 };
      existing.total += timeSpent;
      existing.count += 1;
      quadrantMap.set(task.quadrant, existing);
    }
  }

  const quadrantOrder: QuadrantId[] = [
    "urgent-important",
    "not-urgent-important",
    "urgent-not-important",
    "not-urgent-not-important"
  ];

  return quadrantOrder.map(quadrantId => {
    const data = quadrantMap.get(quadrantId) || { total: 0, count: 0 };
    return {
      quadrantId,
      totalMinutes: data.total,
      taskCount: data.count,
      averageMinutesPerTask: data.count > 0 ? Math.round(data.total / data.count) : 0,
    };
  });
}

/**
 * Get tasks sorted by time discrepancy (how far off estimates were)
 */
export function getTimeComparisonData(tasks: TaskRecord[]): TaskTimeComparison[] {
  const comparisons: TaskTimeComparison[] = [];

  for (const task of tasks) {
    if (task.estimatedMinutes && task.timeSpent) {
      const accuracy = (task.timeSpent / task.estimatedMinutes) * 100;
      comparisons.push({
        taskId: task.id,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.timeSpent,
        accuracy: Math.round(accuracy),
        isOver: task.timeSpent > task.estimatedMinutes,
        isCompleted: task.completed,
      });
    }
  }

  // Sort by how far off the estimate was (most over first)
  return comparisons.sort((a, b) => b.accuracy - a.accuracy);
}

/**
 * Format minutes to a human-readable duration
 * Issue #11: Consolidated to use formatTimeSpent to avoid code duplication
 */
export function formatDuration(minutes: number): string {
  // Use the canonical formatTimeSpent implementation
  // Minor difference: formatTimeSpent returns "< 1m" for 0, formatDuration returns "0m"
  if (minutes === 0) return "0m";
  return formatTimeSpent(minutes);
}
