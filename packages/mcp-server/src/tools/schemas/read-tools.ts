import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Read-only tool schemas for accessing task data and metadata
 * These tools do not modify any data
 */

export const getSyncStatusTool: Tool = {
  name: 'get_sync_status',
  description:
    'Get sync status for GSD tasks including last sync time, device count, storage usage, and conflict count. Useful for checking overall sync health.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const listDevicesTool: Tool = {
  name: 'list_devices',
  description:
    'List all registered devices for the authenticated user. Shows device names, last seen timestamps, and active status. Useful for managing connected devices.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getTaskStatsTool: Tool = {
  name: 'get_task_stats',
  description:
    'Get statistics about tasks including total count, active count, deleted count, and last update timestamp. Provides high-level overview without accessing encrypted task content.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const listTasksTool: Tool = {
  name: 'list_tasks',
  description:
    'List all decrypted tasks. Requires GSD_ENCRYPTION_PASSPHRASE to be set. Returns full task details including titles, descriptions, quadrants, tags, subtasks, and dependencies. Optionally filter by quadrant, completion status, or tags.',
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
    'Get a single decrypted task by ID. Requires GSD_ENCRYPTION_PASSPHRASE to be set. Returns full task details.',
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
    'Search decrypted tasks by text query. Requires GSD_ENCRYPTION_PASSPHRASE to be set. Searches across task titles, descriptions, tags, and subtask text. Returns matching tasks.',
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
