/**
 * Error categorizer - classifies sync errors for appropriate handling
 */

/**
 * Error categories for sync operations
 */
export type ErrorCategory = 'transient' | 'auth' | 'permanent';

/**
 * Categorize a sync error to determine handling strategy
 */
export function categorizeError(error: Error): ErrorCategory {
  // Check for auth errors first
  if (isAuthError(error)) {
    return 'auth';
  }
  
  // Check for permanent errors
  if (isPermanentError(error)) {
    return 'permanent';
  }
  
  // Default to transient (network/timeout/server errors)
  return 'transient';
}

/**
 * Check if error is transient (network/timeout/5xx)
 * These errors should be retried with exponential backoff
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  ) {
    return true;
  }
  
  // 5xx server errors (temporary server issues)
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('bad gateway') ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout')
  ) {
    return true;
  }
  
  // Rate limiting (should retry after backoff)
  if (message.includes('429') || message.includes('too many requests')) {
    return true;
  }
  
  return false;
}

/**
 * Check if error is authentication-related (401/403)
 * These errors should trigger token refresh
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
 * These errors should not be retried
 */
export function isPermanentError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // 4xx client errors (except 401/403/429)
  if (
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
    message.includes('unprocessable')
  ) {
    return true;
  }
  
  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('malformed') ||
    message.includes('parse error')
  ) {
    return true;
  }
  
  // Encryption/decryption errors
  if (
    message.includes('encryption') ||
    message.includes('decryption') ||
    message.includes('decrypt') ||
    message.includes('cipher')
  ) {
    return true;
  }
  
  return false;
}
