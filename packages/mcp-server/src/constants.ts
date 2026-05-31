/**
 * Maximum number of tasks to fetch per pull request
 * Must match Worker schema validation limit
 */
export const MAX_TASKS_PER_PULL = 100;

/**
 * Payload bounds shared by MCP Zod validation and advertised JSON schemas.
 * These mirror the web app task schema so remote tool clients cannot submit
 * larger write payloads than the first-party UI accepts.
 */
export const SCHEMA_LIMITS = {
  ID_MAX_LENGTH: 255,
  TASK_TITLE_MAX_LENGTH: 80,
  TASK_DESCRIPTION_MAX_LENGTH: 600,
  TAG_MAX_LENGTH: 30,
  SUBTASK_TITLE_MAX_LENGTH: 100,
  MAX_TAGS: 20,
  MAX_SUBTASKS: 50,
  MAX_DEPENDENCIES: 50,
  MAX_BULK_TASKS: 50,
} as const;
