import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SCHEMA_LIMITS } from '../../constants.js';

/**
 * Write operation tool schemas for modifying task data
 */

export const createTaskTool: Tool = {
  name: 'create_task',
  description:
    'Create a new task with natural language input. Supports all task properties including title, description, urgency, importance, due dates, tags, subtasks, recurrence, and dependencies. Use dryRun=true to preview without saving.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH,
        description: 'Task title (required)',
      },
      description: {
        type: 'string',
        maxLength: SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH,
        description: 'Task description',
      },
      urgent: {
        type: 'boolean',
        description: 'Is this task urgent? (time-sensitive)',
      },
      important: {
        type: 'boolean',
        description: 'Is this task important? (high-value, strategic)',
      },
      dueDate: {
        type: 'string',
        description: 'Due date as ISO 8601 datetime string (e.g., "2025-10-27T12:00:00.000Z")',
      },
      tags: {
        type: 'array',
        maxItems: SCHEMA_LIMITS.MAX_TAGS,
        items: { type: 'string', minLength: 1, maxLength: SCHEMA_LIMITS.TAG_MAX_LENGTH },
        description: 'Tags for categorization (e.g., ["#work", "#project-alpha"])',
      },
      subtasks: {
        type: 'array',
        maxItems: SCHEMA_LIMITS.MAX_SUBTASKS,
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH,
            },
            completed: { type: 'boolean' },
          },
          required: ['title', 'completed'],
        },
        description: 'Subtasks/checklist items',
      },
      recurrence: {
        type: 'string',
        enum: ['none', 'daily', 'weekly', 'monthly'],
        description: 'Recurrence pattern',
      },
      dependencies: {
        type: 'array',
        maxItems: SCHEMA_LIMITS.MAX_DEPENDENCIES,
        items: { type: 'string', minLength: 1, maxLength: SCHEMA_LIMITS.ID_MAX_LENGTH },
        description: 'Task IDs that must be completed before this task',
      },
      notifyBefore: {
        type: 'number',
        description:
          'Minutes before due date to send a reminder notification (0 disables the reminder)',
        minimum: 0,
      },
      notificationEnabled: {
        type: 'boolean',
        description: 'Whether notifications are enabled for this task (default: true)',
      },
      estimatedMinutes: {
        type: 'number',
        description: 'Estimated time to complete in minutes (1-10080, i.e. up to 7 days)',
        minimum: 1,
        maximum: 10080,
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, validate and show what would be created without actually saving',
      },
    },
    required: ['title', 'urgent', 'important'],
  },
};

export const updateTaskTool: Tool = {
  name: 'update_task',
  description:
    'Update an existing task. All fields except ID are optional - only provide fields you want to change. Supports moving between quadrants, updating content, changing due dates, and more. Use dryRun=true to preview changes.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        maxLength: SCHEMA_LIMITS.ID_MAX_LENGTH,
        description: 'Task ID (required)',
      },
      title: {
        type: 'string',
        minLength: 1,
        maxLength: SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH,
        description: 'New task title',
      },
      description: {
        type: 'string',
        maxLength: SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH,
        description: 'New task description',
      },
      urgent: {
        type: 'boolean',
        description: 'Change urgency (moves between quadrants)',
      },
      important: {
        type: 'boolean',
        description: 'Change importance (moves between quadrants)',
      },
      dueDate: {
        type: 'string',
        description: 'New due date as ISO 8601 datetime string (empty string to clear)',
      },
      tags: {
        type: 'array',
        maxItems: SCHEMA_LIMITS.MAX_TAGS,
        items: { type: 'string', minLength: 1, maxLength: SCHEMA_LIMITS.TAG_MAX_LENGTH },
        description: 'Replace tags entirely',
      },
      subtasks: {
        type: 'array',
        maxItems: SCHEMA_LIMITS.MAX_SUBTASKS,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', minLength: 1, maxLength: SCHEMA_LIMITS.ID_MAX_LENGTH },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH,
            },
            completed: { type: 'boolean' },
          },
          required: ['id', 'title', 'completed'],
        },
        description: 'Replace subtasks entirely',
      },
      recurrence: {
        type: 'string',
        enum: ['none', 'daily', 'weekly', 'monthly'],
        description: 'Change recurrence pattern',
      },
      dependencies: {
        type: 'array',
        maxItems: SCHEMA_LIMITS.MAX_DEPENDENCIES,
        items: { type: 'string', minLength: 1, maxLength: SCHEMA_LIMITS.ID_MAX_LENGTH },
        description: 'Replace dependencies entirely',
      },
      completed: {
        type: 'boolean',
        description: 'Mark as complete/incomplete',
      },
      notifyBefore: {
        type: 'number',
        description: 'Minutes before due date to send a reminder (0 disables the reminder)',
        minimum: 0,
      },
      notificationEnabled: {
        type: 'boolean',
        description: 'Whether notifications are enabled for this task',
      },
      estimatedMinutes: {
        type: 'number',
        description: 'Estimated time to complete in minutes (1-10080)',
        minimum: 1,
        maximum: 10080,
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, validate and show what would change without actually saving',
      },
    },
    required: ['id'],
  },
};

export const completeTaskTool: Tool = {
  name: 'complete_task',
  description:
    'Mark a task as complete or incomplete. Quick shortcut for updating completion status. Use dryRun=true to preview changes.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        maxLength: SCHEMA_LIMITS.ID_MAX_LENGTH,
        description: 'Task ID',
      },
      completed: {
        type: 'boolean',
        description: 'True to mark complete, false to mark incomplete',
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, validate and show what would change without actually saving',
      },
    },
    required: ['id', 'completed'],
  },
};

export const deleteTaskTool: Tool = {
  name: 'delete_task',
  description:
    'Permanently delete a task. This action cannot be undone. Deletes default to dryRun=true, so pass dryRun=false explicitly to apply.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        maxLength: SCHEMA_LIMITS.ID_MAX_LENGTH,
        description: 'Task ID to delete',
      },
      dryRun: {
        type: 'boolean',
        description:
          'If true, show what would be deleted without actually deleting. Defaults to true; pass false explicitly to delete.',
      },
    },
    required: ['id'],
  },
};

export const bulkUpdateTasksTool: Tool = {
  name: 'bulk_update_tasks',
  description:
    'Update multiple tasks at once. Supports completing, moving quadrants, adding/removing tags, setting due dates, and deleting. Limited to 50 tasks per operation (10 for deletes) for safety. Destructive deletes default to dryRun=true — pass dryRun=false explicitly to apply.',
  inputSchema: {
    type: 'object',
    properties: {
      taskIds: {
        type: 'array',
        minItems: 1,
        maxItems: SCHEMA_LIMITS.MAX_BULK_TASKS,
        items: { type: 'string', minLength: 1, maxLength: SCHEMA_LIMITS.ID_MAX_LENGTH },
        description: 'Array of task IDs to update (max 50)',
      },
      operation: {
        type: 'object',
        description: 'Operation to perform on all tasks',
        properties: {
          type: {
            type: 'string',
            enum: ['complete', 'move_quadrant', 'add_tags', 'remove_tags', 'set_due_date', 'delete'],
            description: 'Type of bulk operation',
          },
          // Conditional properties based on type
          completed: {
            type: 'boolean',
            description: 'For type=complete: true/false',
          },
          urgent: {
            type: 'boolean',
            description: 'For type=move_quadrant: urgency',
          },
          important: {
            type: 'boolean',
            description: 'For type=move_quadrant: importance',
          },
          tags: {
            type: 'array',
            minItems: 1,
            maxItems: SCHEMA_LIMITS.MAX_TAGS,
            items: { type: 'string', minLength: 1, maxLength: SCHEMA_LIMITS.TAG_MAX_LENGTH },
            description: 'For type=add_tags or remove_tags: array of tags',
          },
          dueDate: {
            type: 'string',
            description: 'For type=set_due_date: ISO 8601 datetime string (empty string to clear)',
          },
        },
        required: ['type'],
      },
      dryRun: {
        type: 'boolean',
        description:
          'If true, preview changes without saving. Defaults to true for delete operations — pass dryRun=false to actually delete.',
      },
    },
    required: ['taskIds', 'operation'],
  },
};

export const writeTools: Tool[] = [
  createTaskTool,
  updateTaskTool,
  completeTaskTool,
  deleteTaskTool,
  bulkUpdateTasksTool,
];
