import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Analytics tool schemas for productivity metrics and insights
 * All require GSD_ENCRYPTION_PASSPHRASE to access decrypted task data
 */

export const getProductivityMetricsTool: Tool = {
  name: 'get_productivity_metrics',
  description:
    'Get comprehensive productivity metrics including completion counts, streaks, rates, quadrant distribution, tag statistics, and due date tracking. Requires GSD_ENCRYPTION_PASSPHRASE.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getQuadrantAnalysisTool: Tool = {
  name: 'get_quadrant_analysis',
  description:
    'Analyze task distribution and performance across all four Eisenhower matrix quadrants. Shows completion rates, task counts, and identifies top-performing quadrants. Requires GSD_ENCRYPTION_PASSPHRASE.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getTagAnalyticsTool: Tool = {
  name: 'get_tag_analytics',
  description:
    'Get detailed statistics for all tags including usage counts, completion rates, and tag-based insights. Useful for understanding project/category performance. Requires GSD_ENCRYPTION_PASSPHRASE.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of tags to return (default: all)',
      },
    },
    required: [],
  },
};

export const getUpcomingDeadlinesTool: Tool = {
  name: 'get_upcoming_deadlines',
  description:
    'Get tasks grouped by deadline urgency: overdue, due today, and due this week. Useful for prioritizing time-sensitive work. Requires GSD_ENCRYPTION_PASSPHRASE.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getTaskInsightsTool: Tool = {
  name: 'get_task_insights',
  description:
    'Generate an AI-friendly summary of task insights including key metrics, streaks, deadlines, quadrant distribution, and top tags. Perfect for quick status overview. Requires GSD_ENCRYPTION_PASSPHRASE.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const analyticsTools: Tool[] = [
  getProductivityMetricsTool,
  getQuadrantAnalysisTool,
  getTagAnalyticsTool,
  getUpcomingDeadlinesTool,
  getTaskInsightsTool,
];
