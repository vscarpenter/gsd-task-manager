/**
 * Zod schemas that validate tool-call arguments at the MCP dispatcher boundary.
 *
 * The MCP SDK hands us an untyped `arguments` object. Validating here turns
 * "wrong shape from client" into a clean error message before the call reaches
 * PocketBase or the write pipeline.
 *
 * These schemas mirror the JSON Schemas in `tools/schemas/*` — keep them in
 * sync when adding fields.
 */

import { z } from 'zod';
import { SCHEMA_LIMITS } from '../../constants.js';

export const quadrantSchema = z.enum([
  'urgent-important',
  'not-urgent-important',
  'urgent-not-important',
  'not-urgent-not-important',
]);

export const recurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly']);

const optionalIsoDatetime = z.string().datetime({ offset: true }).optional();
const idSchema = z.string().min(1).max(SCHEMA_LIMITS.ID_MAX_LENGTH);
const taskTitleSchema = z.string().min(1).max(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH);
const taskDescriptionSchema = z.string().max(SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH);
const tagSchema = z.string().min(1).max(SCHEMA_LIMITS.TAG_MAX_LENGTH);
const subtaskTitleSchema = z.string().min(1).max(SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH);
const tagsSchema = z.array(tagSchema).max(SCHEMA_LIMITS.MAX_TAGS);
const dependenciesSchema = z.array(idSchema).max(SCHEMA_LIMITS.MAX_DEPENDENCIES);

export const listTasksArgsSchema = z
  .object({
    quadrant: quadrantSchema.optional(),
    completed: z.boolean().optional(),
    tags: tagsSchema.optional(),
  })
  .strict();

export const getTaskArgsSchema = z
  .object({
    taskId: idSchema,
  })
  .strict();

export const searchTasksArgsSchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

export const getTagAnalyticsArgsSchema = z
  .object({
    limit: z.number().int().positive().optional(),
  })
  .strict();

export const getHelpArgsSchema = z
  .object({
    topic: z.enum(['tools', 'analytics', 'setup', 'examples', 'troubleshooting']).optional(),
  })
  .strict();

export const getCacheStatsArgsSchema = z
  .object({
    reset: z.boolean().optional(),
  })
  .strict();

const notifyBeforeSchema = z.number().int().min(0).optional();
const estimatedMinutesSchema = z.number().int().min(1).max(10080).optional();

export const createTaskArgsSchema = z
  .object({
    title: taskTitleSchema,
    description: taskDescriptionSchema.optional(),
    urgent: z.boolean(),
    important: z.boolean(),
    dueDate: optionalIsoDatetime,
    tags: tagsSchema.optional(),
    subtasks: z
      .array(z.object({ title: subtaskTitleSchema, completed: z.boolean() }))
      .max(SCHEMA_LIMITS.MAX_SUBTASKS)
      .optional(),
    recurrence: recurrenceSchema.optional(),
    dependencies: dependenciesSchema.optional(),
    notifyBefore: notifyBeforeSchema,
    notificationEnabled: z.boolean().optional(),
    estimatedMinutes: estimatedMinutesSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();

export const updateTaskArgsSchema = z
  .object({
    id: idSchema,
    title: taskTitleSchema.optional(),
    description: taskDescriptionSchema.optional(),
    urgent: z.boolean().optional(),
    important: z.boolean().optional(),
    // Empty string clears the due date; non-empty must be an ISO 8601 datetime.
    dueDate: z
      .union([z.literal(''), z.string().datetime({ offset: true })])
      .optional(),
    tags: tagsSchema.optional(),
    subtasks: z
      .array(
        z.object({
          id: idSchema,
          title: subtaskTitleSchema,
          completed: z.boolean(),
        })
      )
      .max(SCHEMA_LIMITS.MAX_SUBTASKS)
      .optional(),
    recurrence: recurrenceSchema.optional(),
    dependencies: dependenciesSchema.optional(),
    completed: z.boolean().optional(),
    notifyBefore: notifyBeforeSchema,
    notificationEnabled: z.boolean().optional(),
    estimatedMinutes: estimatedMinutesSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();

export const completeTaskArgsSchema = z
  .object({
    id: idSchema,
    completed: z.boolean(),
    dryRun: z.boolean().optional(),
  })
  .strict();

export const deleteTaskArgsSchema = z
  .object({
    id: idSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();

const bulkOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('complete'), completed: z.boolean() }),
  z.object({
    type: z.literal('move_quadrant'),
    urgent: z.boolean(),
    important: z.boolean(),
  }),
  z.object({ type: z.literal('add_tags'), tags: tagsSchema.min(1) }),
  z.object({ type: z.literal('remove_tags'), tags: tagsSchema.min(1) }),
  z.object({
    type: z.literal('set_due_date'),
    dueDate: z.union([z.literal(''), z.string().datetime({ offset: true })]).optional(),
  }),
  z.object({ type: z.literal('delete') }),
]);

export const bulkUpdateTasksArgsSchema = z
  .object({
    taskIds: z.array(idSchema).min(1).max(SCHEMA_LIMITS.MAX_BULK_TASKS),
    operation: bulkOperationSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();

export const emptyArgsSchema = z.object({}).strict();

/**
 * Map of tool-name → Zod schema. `handleToolCall` consults this before
 * dispatch; tools not present here are passed through unvalidated.
 */
export const toolArgSchemas: Record<string, z.ZodTypeAny> = {
  get_sync_status: emptyArgsSchema,
  list_devices: emptyArgsSchema,
  get_task_stats: emptyArgsSchema,
  list_tasks: listTasksArgsSchema,
  get_task: getTaskArgsSchema,
  search_tasks: searchTasksArgsSchema,
  get_token_status: emptyArgsSchema,
  get_productivity_metrics: emptyArgsSchema,
  get_quadrant_analysis: emptyArgsSchema,
  get_tag_analytics: getTagAnalyticsArgsSchema,
  get_upcoming_deadlines: emptyArgsSchema,
  get_task_insights: emptyArgsSchema,
  create_task: createTaskArgsSchema,
  update_task: updateTaskArgsSchema,
  complete_task: completeTaskArgsSchema,
  delete_task: deleteTaskArgsSchema,
  bulk_update_tasks: bulkUpdateTasksArgsSchema,
  validate_config: emptyArgsSchema,
  get_help: getHelpArgsSchema,
  get_cache_stats: getCacheStatsArgsSchema,
};

/**
 * Validate `args` against the schema registered for `toolName`. Returns the
 * parsed value on success, throws a formatted error on failure.
 */
export function validateToolArgs(toolName: string, args: unknown): unknown {
  const schema = toolArgSchemas[toolName];
  if (!schema) return args;

  const result = schema.safeParse(args);
  if (result.success) return result.data;

  const issues = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${path}: ${issue.message}`;
    })
    .join('\n');
  throw new Error(`Invalid arguments for ${toolName}:\n${issues}`);
}
