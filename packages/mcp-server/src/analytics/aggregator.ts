import type { Task } from '../tools.js';
import { calculateMetrics, getQuadrantPerformance, getUpcomingDeadlines } from './metrics.js';
import type { ProductivityMetrics, QuadrantPerformance, UpcomingDeadlines } from './metrics.js';

export function generateInsightsSummary(tasks: Task[]): string {
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

function addOverviewInsights(insights: string[], metrics: ProductivityMetrics): void {
  insights.push(
    `Task Overview: ${metrics.totalTasks} total tasks (${metrics.activeTasks} active, ${metrics.completedTasks} completed)`
  );
  insights.push(`Completion Rate: ${metrics.completionRate}%`);
}

function addStreakInsights(insights: string[], metrics: ProductivityMetrics): void {
  if (metrics.activeStreak > 0) {
    const streakDays = metrics.activeStreak > 1 ? 's' : '';
    insights.push(
      `Current Streak: ${metrics.activeStreak} day${streakDays} (longest: ${metrics.longestStreak})`
    );
  }
}

function addActivityInsights(insights: string[], metrics: ProductivityMetrics): void {
  if (metrics.completedToday > 0) {
    const taskPlural = metrics.completedToday > 1 ? 's' : '';
    insights.push(`Completed Today: ${metrics.completedToday} task${taskPlural}`);
  }
}

function addDeadlineInsights(insights: string[], deadlines: UpcomingDeadlines): void {
  if (deadlines.overdue.length > 0) {
    const taskPlural = deadlines.overdue.length > 1 ? 's' : '';
    insights.push(`⚠️  ${deadlines.overdue.length} overdue task${taskPlural}`);
  }

  if (deadlines.dueToday.length > 0) {
    const taskPlural = deadlines.dueToday.length > 1 ? 's' : '';
    insights.push(`${deadlines.dueToday.length} task${taskPlural} due today`);
  }
}

function addQuadrantInsights(insights: string[], quadrants: QuadrantPerformance[]): void {
  // getQuadrantPerformance sorts by completion rate, so pick by active count.
  const topQuadrant = quadrants.reduce<QuadrantPerformance | undefined>(
    (busiest, quadrant) => (!busiest || quadrant.activeTasks > busiest.activeTasks ? quadrant : busiest),
    undefined
  );
  if (topQuadrant && topQuadrant.activeTasks > 0) {
    insights.push(
      `Most tasks in ${topQuadrant.name}: ${topQuadrant.activeTasks} active (${topQuadrant.completionRate}% completion rate)`
    );
  }
}

function addTagInsights(insights: string[], metrics: ProductivityMetrics): void {
  if (metrics.tagStats.length > 0) {
    const topTag = metrics.tagStats[0];
    insights.push(
      `Most used tag: ${topTag.tag} (${topTag.count} tasks, ${topTag.completionRate}% completed)`
    );
  }
}
