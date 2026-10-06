/**
 * Streak calculation logic for task completion tracking
 */

import type { Task } from '../tools.js';
import { completionTime, daysBetweenKeys, localDayKey, startOfDay, subDays } from './date-utils.js';

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
export function getStreakData(tasks: Task[]): StreakData {
  const completedTasks = tasks.filter((t) => t.completed);

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
 * Get unique local completion days sorted (newest first)
 */
function getUniqueCompletionDates(completedTasks: Task[]): string[] {
  const completionDates = new Set<string>();

  completedTasks.forEach((task) => {
    completionDates.add(localDayKey(completionTime(task)));
  });

  return Array.from(completionDates).sort().reverse();
}

/**
 * Calculate current streak from today backwards, one local day at a time
 */
function calculateCurrentStreak(uniqueDates: string[]): number {
  const uniqueDateSet = new Set(uniqueDates);
  let currentStreak = 0;
  // Stepping local midnights keeps a DST change from skipping or repeating a day.
  let checkDate = startOfDay(new Date());

  while (uniqueDateSet.has(localDayKey(checkDate))) {
    currentStreak++;
    checkDate = subDays(checkDate, 1);
  }

  return currentStreak;
}

/**
 * Calculate longest streak in history
 */
function calculateLongestStreak(uniqueDates: string[], currentStreak: number): number {
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const daysDiff = daysBetweenKeys(uniqueDates[i - 1], uniqueDates[i]);

    if (daysDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  return Math.max(longestStreak, tempStreak, currentStreak);
}

