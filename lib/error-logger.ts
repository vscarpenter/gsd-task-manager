/**
 * Structured error logging and handling utilities
 *
 * Follows coding standards:
 * - Log with context (no secrets)
 * - Fail fast with clear messages
 * - Never swallow exceptions
 */

export interface ErrorContext {
  action: string;
  taskId?: string;
  userId?: string;
  timestamp: string;
  userMessage: string;
  metadata?: Record<string, unknown>;
}

export interface LoggedError extends ErrorContext {
  errorType: string;
  errorMessage: string;
  stack?: string;
}

/**
 * Log an error with structured context
 * In production, this would send to Sentry, Datadog, etc.
 */
export function logError(error: unknown, context: ErrorContext): LoggedError {
  const timestamp = new Date().toISOString();

  const loggedError: LoggedError = {
    ...context,
    timestamp,
    errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  };

  // In development, log to console with full context
  if (process.env.NODE_ENV === 'development') {
    console.error('[GSD Error]', {
      ...loggedError,
      originalError: error
    });
  } else {
    // In production, send to error tracking service
    // Example: Sentry.captureException(error, { contexts: { gsd: loggedError } });
    console.error('[GSD Error]', {
      action: loggedError.action,
      errorType: loggedError.errorType,
      errorMessage: loggedError.errorMessage,
      timestamp: loggedError.timestamp
    });
  }

  return loggedError;
}

/**
 * Create user-friendly error messages based on error type
 */
export function getUserErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    // Map known error types to user-friendly messages
    if (error.message.includes('not found')) {
      return 'The item you\'re looking for could not be found. It may have been deleted.';
    }
    if (error.message.includes('Invalid JSON')) {
      return 'The file format is invalid. Please select a valid export file.';
    }
    if (error.message.includes('IndexedDB')) {
      return 'Unable to access local storage. Please check your browser settings.';
    }
    // For Zod validation errors
    if (error.name === 'ZodError') {
      return 'The data provided is invalid. Please check your input and try again.';
    }
  }

  return defaultMessage;
}

/**
 * Common error contexts for the application
 */
export const ErrorActions = {
  // Task operations
  CREATE_TASK: 'create_task',
  UPDATE_TASK: 'update_task',
  DELETE_TASK: 'delete_task',
  TOGGLE_TASK: 'toggle_task_completion',
  MOVE_TASK: 'move_task_to_quadrant',

  // Import/Export
  EXPORT_TASKS: 'export_tasks',
  IMPORT_TASKS: 'import_tasks',
  PARSE_JSON: 'parse_import_file',

  // Subtasks
  ADD_SUBTASK: 'add_subtask',
  DELETE_SUBTASK: 'delete_subtask',
  TOGGLE_SUBTASK: 'toggle_subtask',

  // Smart Views
  SAVE_SMART_VIEW: 'save_smart_view',
  DELETE_SMART_VIEW: 'delete_smart_view',
  LOAD_SMART_VIEWS: 'load_smart_views'
} as const;

/**
 * Common user-facing error messages
 */
export const ErrorMessages = {
  TASK_SAVE_FAILED: 'Unable to save task. Please try again.',
  TASK_DELETE_FAILED: 'Failed to delete task. Please try again.',
  TASK_UPDATE_FAILED: 'Failed to update task state. Please try again.',
  TASK_MOVE_FAILED: 'Failed to move task. Please try again.',
  TASK_RESTORE_FAILED: 'Failed to restore task.',

  EXPORT_FAILED: 'Export failed. Please try again.',
  IMPORT_FAILED: 'Import failed. Please select a valid export file.',
  IMPORT_INVALID_FORMAT: 'Invalid file format. Please select a valid JSON export file.',

  SMART_VIEW_SAVE_FAILED: 'Failed to save Smart View. Please try again.',
  SMART_VIEW_DELETE_FAILED: 'Failed to delete Smart View. Please try again.'
} as const;
