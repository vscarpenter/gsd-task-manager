import { listTasks, type GsdConfig } from '../../tools.js';
import {
  calculateMetrics,
  getQuadrantPerformance,
  getUpcomingDeadlines,
  generateInsightsSummary,
} from '../../analytics.js';
import type { McpToolResponse } from './types.js';

/**
 * Analytics tool handlers for productivity metrics and insights
 */

export async function handleGetProductivityMetrics(config: GsdConfig): Promise<McpToolResponse> {
  const tasks = await listTasks(config);
  const metrics = calculateMetrics(tasks);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(metrics, null, 2),
      },
    ],
  };
}

export async function handleGetQuadrantAnalysis(config: GsdConfig): Promise<McpToolResponse> {
  const tasks = await listTasks(config);
  const quadrants = getQuadrantPerformance(tasks);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(quadrants, null, 2),
      },
    ],
  };
}

export async function handleGetTagAnalytics(config: GsdConfig, args: { limit?: number }): Promise<McpToolResponse> {
  const tasks = await listTasks(config);
  const metrics = calculateMetrics(tasks);
  const tagStats = args.limit ? metrics.tagStats.slice(0, args.limit) : metrics.tagStats;
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(tagStats, null, 2),
      },
    ],
  };
}

export async function handleGetUpcomingDeadlines(config: GsdConfig): Promise<McpToolResponse> {
  const tasks = await listTasks(config);
  const deadlines = getUpcomingDeadlines(tasks);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(deadlines, null, 2),
      },
    ],
  };
}

export async function handleGetTaskInsights(config: GsdConfig): Promise<McpToolResponse> {
  const tasks = await listTasks(config);
  const insights = generateInsightsSummary(tasks);
  return {
    content: [
      {
        type: 'text' as const,
        text: insights,
      },
    ],
  };
}
