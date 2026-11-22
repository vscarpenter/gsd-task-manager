export const SCHEMA_LIMITS = {
  /** Minimum length for generated IDs (tasks, subtasks, dependencies) */
  ID_MIN_LENGTH: 4,

  SUBTASK_TITLE_MAX_LENGTH: 100,

  TASK_TITLE_MAX_LENGTH: 80,

  TASK_DESCRIPTION_MAX_LENGTH: 600,

  TAG_MAX_LENGTH: 30,

  TIME_ENTRY_NOTES_MAX_LENGTH: 200,

  /** Default minutes before due date to send notifications */
  DEFAULT_NOTIFY_MINUTES: 15,

  /** Maximum number of tags per task */
  MAX_TAGS: 20,

  MAX_SUBTASKS: 50,

  MAX_DEPENDENCIES: 50,

  MAX_TIME_ENTRIES: 1000,

  /** Maximum custom smart views retained or accepted in one backup */
  MAX_SMART_VIEWS: 100,
  /**
   * Maximum tags one smart view may FILTER BY. Deliberately not `MAX_TAGS`,
   * which bounds the tags a single task may CARRY: a view draws from the whole
   * workspace vocabulary, so the two quantities are unrelated.
   */
  MAX_SMART_VIEW_FILTER_TAGS: 200,
  SMART_VIEW_ID_MAX_LENGTH: 128,
  SMART_VIEW_NAME_MAX_LENGTH: 80,
  SMART_VIEW_DESCRIPTION_MAX_LENGTH: 600,
  SMART_VIEW_ICON_MAX_LENGTH: 64,
  SMART_VIEW_SEARCH_MAX_LENGTH: 600,
  /** Maximum persisted date-filter string length */
  SMART_VIEW_DATE_MAX_LENGTH: 64,
  /** Maximum legacy date-filter mode length */
  SMART_VIEW_MODE_MAX_LENGTH: 64,
  /** Maximum custom smart views that preferences may pin */
  MAX_PINNED_SMART_VIEWS: 5,
  /** Maximum structural depth below a smart-view import envelope */
  SMART_VIEW_MAX_DEPTH: 6,
  /** Maximum aggregate child values in a smart-view import envelope */
  SMART_VIEW_MAX_INPUT_NODES: 10_000,
  /** Maximum aggregate UTF-8 string bytes in smart-view data */
  SMART_VIEW_MAX_STRING_BYTES: 256 * 1024,
} as const;

