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

export const quadrantSchema = z.enum([
  'urgent-important',
  'not-urgent-important',
  'urgent-not-important',
  'not-urgent-not-important',
]);

export const recurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly']);

const optionalIsoDatetime = z.string().datetime({ offset: true }).optional();

export const listTasksArgsSchema = z
  .object({
    quadrant: quadrantSchema.optional(),
    completed: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const getTaskArgsSchema = z
  .object({
    taskId: z.string().min(1),
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
    title: z.string().min(1),
    description: z.string().optional(),
    urgent: z.boolean(),
    important: z.boolean(),
    dueDate: optionalIsoDatetime,
    tags: z.array(z.string()).optional(),
    subtasks: z
      .array(z.object({ title: z.string().min(1), completed: z.boolean() }))
      .optional(),
    recurrence: recurrenceSchema.optional(),
    dependencies: z.array(z.string().min(1)).optional(),
    notifyBefore: notifyBeforeSchema,
    notificationEnabled: z.boolean().optional(),
    estimatedMinutes: estimatedMinutesSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();

export const updateTaskArgsSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    urgent: z.boolean().optional(),
    important: z.boolean().optional(),
    // Empty string clears the due date; non-empty must be an ISO 8601 datetime.
    dueDate: z
      .union([z.literal(''), z.string().datetime({ offset: true })])
      .optional(),
    tags: z.array(z.string()).optional(),
    subtasks: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          completed: z.boolean(),
        })
      )
      .optional(),
    recurrence: recurrenceSchema.optional(),
    dependencies: z.array(z.string().min(1)).optional(),
    completed: z.boolean().optional(),
    notifyBefore: notifyBeforeSchema,
    notificationEnabled: z.boolean().optional(),
    estimatedMinutes: estimatedMinutesSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();

export const completeTaskArgsSchema = z
  .object({
    id: z.string().min(1),
    completed: z.boolean(),
    dryRun: z.boolean().optional(),
  })
  .strict();

export const deleteTaskArgsSchema = z
  .object({
    id: z.string().min(1),
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
  z.object({ type: z.literal('add_tags'), tags: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('remove_tags'), tags: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal('set_due_date'),
    dueDate: z.union([z.literal(''), z.string().datetime({ offset: true })]).optional(),
  }),
  z.object({ type: z.literal('delete') }),
]);

export const bulkUpdateTasksArgsSchema = z
  .object({
    taskIds: z.array(z.string().min(1)).min(1).max(50),
    operation: bulkOperationSchema,
    maxTasks: z.number().int().positive().optional(),
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
