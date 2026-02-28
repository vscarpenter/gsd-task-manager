/**
 * Typed error classes for sync operations
 * Provides structured error handling with specific error types
 */

/**
 * Base class for all sync-related errors
 */
export class SyncError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * Network or connectivity errors (transient - should retry)
 */
export class SyncNetworkError extends SyncError {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'SyncNetworkError';
  }
}

/**
 * Authentication/authorization errors (need re-login)
 */
export class SyncAuthError extends SyncError {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'SyncAuthError';
  }
}

/**
 * Validation errors (permanent - don't retry)
 */
export class SyncValidationError extends SyncError {
  constructor(message: string, public validationErrors?: unknown) {
    super(message, validationErrors);
    this.name = 'SyncValidationError';
  }
}

/**
 * Type guard to check if error is a sync error
 */
export function isSyncError(error: unknown): error is SyncError {
  return error instanceof SyncError;
}

/**
 * Type guard to check if error is network-related
 */
export function isNetworkError(error: unknown): error is SyncNetworkError {
  return error instanceof SyncNetworkError;
}

/**
 * Type guard to check if error is auth-related
 */
export function isAuthError(error: unknown): error is SyncAuthError {
  return error instanceof SyncAuthError;
}

/**
 * Type guard to check if error is validation-related
 */
export function isValidationError(error: unknown): error is SyncValidationError {
  return error instanceof SyncValidationError;
}
