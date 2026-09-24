import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Read-only tool schemas for accessing task data and metadata
 * These tools do not modify any data
 */

export const getSyncStatusTool: Tool = {
  name: 'get_sync_status',
  description:
    'Check PocketBase sync backend health. Returns healthy (boolean), taskCount, authenticated, and the redacted pocketBaseUrl. lastSyncAt is always null: PocketBase is live, so there is no last-sync timestamp. Use validate_config for a full diagnostic and get_task_stats for task counts by status.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const listDevicesTool: Tool = {
  name: 'list_devices',
  description:
    'List devices registered for the authenticated user, most recently seen first. Returns id, name (null when the device is unnamed), and lastSeenAt for each device. isActive and isCurrent are placeholders (always true and false). Returns an empty list when the devices collection does not exist yet.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getTaskStatsTool: Tool = {
  name: 'get_task_stats',
  description:
    'Get task counts: totalTasks, activeTasks (not completed), completedTasks, plus lastUpdated, oldestTask, and newestTask timestamps. Counts cover every task in the account regardless of quadrant. Use list_tasks when you need the tasks themselves rather than counts.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const listTasksTool: Tool = {
  name: 'list_tasks',
  description:
    'List tasks with optional filters. Returns full task objects (title, description, quadrant, urgent/important, tags, subtasks, dependencies, dueDate, completed, timestamps) sorted by most recently updated first. Without filters it returns every task, completed ones included; pass completed=false for the active list. Multiple filters combine with AND; the tags filter matches a task that has any of the given tags. Results come from a short-lived cache that is invalidated on every write.',
  inputSchema: {
    type: 'object',
    properties: {
      quadrant: {
        type: 'string',
        description:
          'Filter by quadrant ID (urgent-important, not-urgent-important, urgent-not-important, not-urgent-not-important)',
        enum: [
          'urgent-important',
          'not-urgent-important',
          'urgent-not-important',
          'not-urgent-not-important',
        ],
      },
      completed: {
        type: 'boolean',
        description: 'Filter by completion status (true for completed, false for active)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (tasks matching any of these tags will be returned)',
      },
    },
    required: [],
  },
};

export const getTaskTool: Tool = {
  name: 'get_task',
  description:
    'Get a single task by its ID. Returns the full task object. Fails with "Task not found" when no task has that ID; use search_tasks or list_tasks to find an ID first.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The unique ID of the task to retrieve',
      },
    },
    required: ['taskId'],
  },
};

export const searchTasksTool: Tool = {
  name: 'search_tasks',
  description:
    'Search tasks by a case-insensitive substring match against titles, descriptions, tags, and subtask titles. Returns full task objects for every match, completed tasks included, most recently updated first; there is no relevance ranking. Use list_tasks with filters when you need a quadrant, tag, or completion filter rather than free text.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to match against task content',
      },
    },
    required: ['query'],
  },
};

export const getTokenStatusTool: Tool = {
  name: 'get_token_status',
  description:
    'Check authentication token status including expiration date, days remaining, and warnings. Use this to proactively check if re-authentication is needed. Returns status (healthy/warning/critical/expired), expiration details, and re-authentication instructions if needed.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const readTools: Tool[] = [
  getSyncStatusTool,
  listDevicesTool,
  getTaskStatsTool,
  listTasksTool,
  getTaskTool,
  searchTasksTool,
  getTokenStatusTool,
];
