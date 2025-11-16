/**
 * Data aggregation utilities for analytics insights
 */

import type { DecryptedTask } from '../tools.js';
import { calculateMetrics } from './metrics.js';
import { getQuadrantPerformance, getUpcomingDeadlines } from './metrics.js';

/**
 * Generate AI-friendly task insights summary
 */
export function generateInsightsSummary(tasks: DecryptedTask[]): string {
  const metrics = calculateMetrics(tasks);
  const quadrants = getQuadrantPerformance(tasks);
  const deadlines = getUpcomingDeadlines(tasks);

  const insights: string[] = [];

  addOverviewInsights(insights, metrics);
  addStreakInsights(insights, metrics);
  addActivityInsights(insights, metrics);
  addDeadlineInsights(insights, deadlines);
  addQuadrantInsights(insights, quadrants);
  addTagInsights(insights, metrics);

  return insights.join('\n');
}

/**
 * Add overall task overview insights
 */
function addOverviewInsights(insights: string[], metrics: any): void {
  insights.push(
    `Task Overview: ${metrics.totalTasks} total tasks (${metrics.activeTasks} active, ${metrics.completedTasks} completed)`
  );
  insights.push(`Completion Rate: ${metrics.completionRate}%`);
}

/**
 * Add streak insights
 */
function addStreakInsights(insights: string[], metrics: any): void {
  if (metrics.activeStreak > 0) {
    const streakDays = metrics.activeStreak > 1 ? 's' : '';
    insights.push(
      `Current Streak: ${metrics.activeStreak} day${streakDays} (longest: ${metrics.longestStreak})`
    );
  }
}

/**
 * Add recent activity insights
 */
function addActivityInsights(insights: string[], metrics: any): void {
  if (metrics.completedToday > 0) {
    const taskPlural = metrics.completedToday > 1 ? 's' : '';
    insights.push(`Completed Today: ${metrics.completedToday} task${taskPlural}`);
  }
}

/**
 * Add deadline insights
 */
function addDeadlineInsights(insights: string[], deadlines: any): void {
  if (deadlines.overdue.length > 0) {
    const taskPlural = deadlines.overdue.length > 1 ? 's' : '';
    insights.push(`⚠️  ${deadlines.overdue.length} overdue task${taskPlural}`);
  }

  if (deadlines.dueToday.length > 0) {
    const taskPlural = deadlines.dueToday.length > 1 ? 's' : '';
    insights.push(`${deadlines.dueToday.length} task${taskPlural} due today`);
  }
}

/**
 * Add quadrant distribution insights
 */
function addQuadrantInsights(insights: string[], quadrants: any[]): void {
  const topQuadrant = quadrants[0];
  if (topQuadrant && topQuadrant.activeTasks > 0) {
    insights.push(
      `Most tasks in ${topQuadrant.name}: ${topQuadrant.activeTasks} active (${topQuadrant.completionRate}% completion rate)`
    );
  }
}

/**
 * Add tag usage insights
 */
function addTagInsights(insights: string[], metrics: any): void {
  if (metrics.tagStats.length > 0) {
    const topTag = metrics.tagStats[0];
    insights.push(
      `Most used tag: ${topTag.tag} (${topTag.count} tasks, ${topTag.completionRate}% completed)`
    );
  }
}
