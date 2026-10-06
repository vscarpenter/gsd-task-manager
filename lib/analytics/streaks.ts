import type { TaskRecord } from "@/lib/types";
import { differenceInCalendarDays, parseISO, startOfDay, subDays } from "date-fns";
import { completionTime, localDayKey } from "./completion-day";

/**
 * Streak data
 */
export interface StreakData {
  current: number;
  longest: number;
  lastCompletionDate: string | null;
  last7Days: boolean[];
}

/**
 * Calculate current and longest streak of task completion
 * A streak is broken if a local calendar day passes without completing any tasks
 */
export function getStreakData(tasks: TaskRecord[]): StreakData {
  const completedTasks = tasks.filter(t => t.completed);

  if (completedTasks.length === 0) {
    return { current: 0, longest: 0, lastCompletionDate: null, last7Days: Array(7).fill(false) as boolean[] };
  }

  const uniqueDates = getUniqueCompletionDates(completedTasks);
  const currentStreak = calculateCurrentStreak(uniqueDates);
  const longestStreak = calculateLongestStreak(uniqueDates, currentStreak);

  return {
    current: currentStreak,
    longest: longestStreak,
    lastCompletionDate: uniqueDates[0] || null,
    last7Days: getLast7Days(new Set(uniqueDates))
  };
}

/**
 * Get unique local completion days sorted in descending order
 */
function getUniqueCompletionDates(completedTasks: TaskRecord[]): string[] {
  const completionDates = new Set<string>();
  completedTasks.forEach(task => {
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
 * Calculate longest streak from all completion dates
 */
function calculateLongestStreak(uniqueDates: string[], currentStreak: number): number {
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
 * Build an array of 7 booleans representing task completion for the last 7 local days.
 * Index 0 = 6 days ago, index 6 = today (left-to-right chronological).
 */
function getLast7Days(completionDates: Set<string>): boolean[] {
  const today = startOfDay(new Date());

  const result: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    result.push(completionDates.has(localDayKey(subDays(today, i))));
  }
  return result;
}

/**
 * Calculate calendar days between two yyyy-MM-dd day keys
 */
function calculateDaysDifference(date1: string, date2: string): number {
  return differenceInCalendarDays(parseISO(date1), parseISO(date2));
}
