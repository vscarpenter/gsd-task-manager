/**
 * Schema validation constants
 * Centralizes validation limits for Zod schemas and form validation
 */

/**
 * String length limits for schema validation
 */
export const SCHEMA_LIMITS = {
  /** Minimum length for generated IDs (tasks, subtasks, dependencies) */
  ID_MIN_LENGTH: 4,

  /** Maximum length for subtask titles */
  SUBTASK_TITLE_MAX_LENGTH: 100,

  /** Maximum length for task titles */
  TASK_TITLE_MAX_LENGTH: 80,

  /** Maximum length for task descriptions */
  TASK_DESCRIPTION_MAX_LENGTH: 600,

  /** Maximum length for individual tags */
  TAG_MAX_LENGTH: 30,
} as const;

/**
 * Pagination and list limits
 */
export const PAGINATION_LIMITS = {
  /** Default limit for history queries */
  DEFAULT_HISTORY_LIMIT: 50,

  /** Maximum tags to show in analytics */
  MAX_TAGS_DISPLAY: 10,

  /** Maximum tasks to process in bulk operations */
  MAX_BULK_TASKS: 50,
} as const;

/**
 * Time-based filter constants
 */
export const FILTER_CONSTANTS = {
  /** Days for "recently added/completed" filters */
  RECENT_ACTIVITY_DAYS: 7,

  /** Milliseconds in one day */
  MS_PER_DAY: 24 * 60 * 60 * 1000,
} as const;
