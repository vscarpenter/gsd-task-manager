/**
 * Error categorizer - classifies sync errors for appropriate handling
 */

export type ErrorCategory = 'transient' | 'auth' | 'permanent';

/**
 * Categorize a sync error to determine handling strategy
 */
export function categorizeError(error: Error): ErrorCategory {
  if (isAuthError(error)) return 'auth';
  if (isPermanentError(error)) return 'permanent';
  return 'transient';
}

/**
 * Check if error is transient (network/timeout/5xx)
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();

  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('bad gateway') ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout') ||
    message.includes('429') ||
    message.includes('too many requests')
  );
}

/**
 * Check if error is authentication-related (401/403)
 */
export function isAuthError(error: Error): boolean {
  const message = error.message.toLowerCase();

  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication') ||
    message.includes('token expired') ||
    message.includes('invalid token')
  );
}

/**
 * Check if error is permanent (400/404/validation)
 */
export function isPermanentError(error: Error): boolean {
  const message = error.message.toLowerCase();

  return (
    message.includes('400') ||
    message.includes('404') ||
    message.includes('405') ||
    message.includes('409') ||
    message.includes('410') ||
    message.includes('422') ||
    message.includes('bad request') ||
    message.includes('not found') ||
    message.includes('method not allowed') ||
    message.includes('conflict') ||
    message.includes('gone') ||
    message.includes('unprocessable') ||
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('malformed') ||
    message.includes('parse error')
  );
}
