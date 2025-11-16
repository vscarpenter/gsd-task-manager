/**
 * Streak calculation logic for task completion tracking
 */

import type { DecryptedTask } from '../tools.js';
import { subDays } from './date-utils.js';

/**
 * Streak data
 */
export interface StreakData {
  current: number;
  longest: number;
  lastCompletionDate: string | null;
}

/**
 * Calculate current and longest streak
 */
export function getStreakData(tasks: DecryptedTask[]): StreakData {
  const completedTasks = getCompletedTasksSorted(tasks);

  if (completedTasks.length === 0) {
    return { current: 0, longest: 0, lastCompletionDate: null };
  }

  const uniqueDates = getUniqueCompletionDates(completedTasks);
  const currentStreak = calculateCurrentStreak(uniqueDates);
  const longestStreak = calculateLongestStreak(uniqueDates, currentStreak);

  return {
    current: currentStreak,
    longest: longestStreak,
    lastCompletionDate: uniqueDates[0] || null,
  };
}

/**
 * Get completed tasks sorted by date (newest first)
 */
function getCompletedTasksSorted(tasks: DecryptedTask[]): DecryptedTask[] {
  return tasks
    .filter((t) => t.completed)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Get unique completion dates sorted (newest first)
 */
function getUniqueCompletionDates(completedTasks: DecryptedTask[]): string[] {
  const completionDates = new Set<string>();

  completedTasks.forEach((task) => {
    const date = new Date(task.updatedAt).toISOString().split('T')[0];
    completionDates.add(date);
  });

  return Array.from(completionDates).sort().reverse();
}

/**
 * Calculate current streak from today backwards
 */
function calculateCurrentStreak(uniqueDates: string[]): number {
  let currentStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);

  for (let i = 0; i < uniqueDates.length; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];

    if (uniqueDates.includes(dateStr)) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return currentStreak;
}

/**
 * Calculate longest streak in history
 */
function calculateLongestStreak(uniqueDates: string[], currentStreak: number): number {
  if (uniqueDates.length <= 1) {
    return currentStreak;
  }

  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const daysDiff = calculateDaysDifference(uniqueDates[i - 1], uniqueDates[i]);

    if (daysDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  return Math.max(longestStreak, tempStreak, currentStreak);
}

/**
 * Calculate days difference between two date strings
 */
function calculateDaysDifference(date1Str: string, date2Str: string): number {
  const prevDate = new Date(date1Str);
  const currDate = new Date(date2Str);
  return Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
}
