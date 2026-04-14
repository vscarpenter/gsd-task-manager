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

  /** Maximum length for time entry notes */
  TIME_ENTRY_NOTES_MAX_LENGTH: 200,

  /** Default minutes before due date to send notifications */
  DEFAULT_NOTIFY_MINUTES: 15,
} as const;

