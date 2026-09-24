import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Analytics tool schemas for productivity metrics and insights
 */

export const getProductivityMetricsTool: Tool = {
  name: 'get_productivity_metrics',
  description:
    'Get comprehensive productivity metrics including completion counts, streaks, rates, quadrant distribution, tag statistics, and due date tracking.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const getQuadrantAnalysisTool: Tool = {
  name: 'get_quadrant_analysis',
  description:
    'Analyze task distribution and performance across all four Eisenhower matrix quadrants. Shows completion rates, task counts, and identifies top-performing quadrants.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getTagAnalyticsTool: Tool = {
  name: 'get_tag_analytics',
  description:
    'Get per-tag statistics: usage counts and completion rates for every tag. This is the tagStats section of get_productivity_metrics on its own; call this when only tag data is needed, and get_productivity_metrics when you also need completion counts, streaks, or quadrant distribution.',
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

const getUpcomingDeadlinesTool: Tool = {
  name: 'get_upcoming_deadlines',
  description:
    'Get tasks grouped by deadline urgency: overdue, due today, and due this week. Useful for prioritizing time-sensitive work.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const getTaskInsightsTool: Tool = {
  name: 'get_task_insights',
  description:
    'Get a prose summary of key metrics, streaks, upcoming deadlines, quadrant distribution, and top tags, computed from the same data as get_productivity_metrics. Returns text rather than JSON; use get_productivity_metrics when you need numbers to compute with.',
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
