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
 * Should this failure be treated as transient operational noise?
 *
 * Returns true for errors the retry/backoff machinery already handles
 * (network blips, 5xx, 429, PocketBase SDK `status === 0`). Callers use
 * this to choose WARN over ERROR log severity so error-monitoring tools
 * are not flooded with handled events from offline-leg syncs and brief
 * backend hiccups.
 *
 * Returns false for unknown errors so genuinely new failure modes still
 * surface as ERROR for investigation.
 */
export function isTransientSyncFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // PocketBase ClientResponseError exposes a numeric `status` field; a 0
  // means the fetch never produced an HTTP response (network fault or
  // aborted request). This is the canonical "ClientResponseError 0:
  // Something went wrong." signature and is purely operational noise.
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status === 0) return true;

  return isTransientError(error);
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

/** Stable error codes for sync queue / sync history persistence. */
export type SyncErrorCode =
  | 'rate_limited'
  | 'unauthorized'
  | 'validation_failed'
  | 'not_found'
  | 'server_error'
  | 'network_error'
  | 'unknown_error';

/**
 * Convert an arbitrary thrown value into a stable error code suitable for
 * persisting in the sync queue / sync history. Strips all original message
 * content so that PocketBase 4xx responses (which echo the request payload —
 * e.g. validation errors quoting the task title) cannot leak task content
 * into `db.syncQueue.lastError` or `db.syncHistory.errorMessage`.
 */
export function sanitizeSyncError(error: unknown): SyncErrorCode {
  if (!(error instanceof Error)) {
    return 'unknown_error';
  }

  // PocketBase ClientResponseError surfaces network faults as `status === 0`
  // with a generic "Something went wrong." message. Detect via the structured
  // status field rather than the (unreliable) message text.
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status === 0) {
    return 'network_error';
  }

  const message = error.message.toLowerCase();

  // Rate limit must be checked first — 429 contains '4' and the validation
  // branch matches things like '422'. Order: rate → auth → validation/404 → 5xx → network.
  if (message.includes('429') || message.includes('too many requests')) {
    return 'rate_limited';
  }
  if (isAuthError(error)) {
    return 'unauthorized';
  }
  if (message.includes('404') || message.includes('not found')) {
    return 'not_found';
  }
  if (
    message.includes('400') ||
    message.includes('422') ||
    message.includes('bad request') ||
    message.includes('unprocessable') ||
    message.includes('validation') ||
    message.includes('failed to validate')
  ) {
    return 'validation_failed';
  }
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
    return 'server_error';
  }
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  ) {
    return 'network_error';
  }
  return 'unknown_error';
}

/**
 * Parse an HTTP `Retry-After` header value into a delay in milliseconds.
 * Accepts either a numeric seconds value (`"30"`) or an HTTP-date.
 * Returns `null` for missing/garbage input; clamps negative values to 0.
 */
export function parseRetryAfterMs(value: string | null | undefined): number | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Numeric seconds
  if (/^-?\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (Number.isNaN(seconds)) return null;
    return Math.max(0, seconds * 1000);
  }

  // HTTP-date
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, timestamp - Date.now());
}

/**
 * Read a previously-captured Retry-After delay (in ms) off a thrown sync error.
 *
 * PocketBase's ClientResponseError forwards only `status` and the parsed body —
 * never response headers. `pocketbase-client`'s afterSend hook folds the parsed
 * `Retry-After` value into that body as `retryAfterMs`, so the 429 backoff path
 * can read it back here without reaching into the SDK's internals. Returns
 * `null` when no usable hint is present.
 */
export function extractRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return null;

  const ms = (response as { retryAfterMs?: unknown }).retryAfterMs;
  if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) return ms;
  return null;
}
