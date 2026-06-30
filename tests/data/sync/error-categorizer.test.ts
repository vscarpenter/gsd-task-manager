import { describe, it, expect } from 'vitest';
import {
  categorizeError,
  isTransientError,
  isTransientSyncFailure,
  isAuthError,
  isPermanentError,
  sanitizeSyncError,
  parseRetryAfterMs,
  extractRetryAfterMs,
} from '@/lib/sync/error-categorizer';

describe('error-categorizer', () => {
  describe('categorizeError', () => {
    it('should categorize auth errors first', () => {
      expect(categorizeError(new Error('401 Unauthorized'))).toBe('auth');
      expect(categorizeError(new Error('403 Forbidden'))).toBe('auth');
      expect(categorizeError(new Error('Token expired'))).toBe('auth');
    });

    it('should categorize permanent errors second', () => {
      expect(categorizeError(new Error('400 Bad Request'))).toBe('permanent');
      expect(categorizeError(new Error('404 Not Found'))).toBe('permanent');
      expect(categorizeError(new Error('422 Unprocessable'))).toBe('permanent');
    });

    it('should default to transient for unknown errors', () => {
      expect(categorizeError(new Error('Something went wrong'))).toBe('transient');
    });

    it('should categorize network errors as transient', () => {
      expect(categorizeError(new Error('Network error'))).toBe('transient');
    });
  });

  describe('isTransientError', () => {
    it.each([
      'Network error',
      'Request timeout',
      'Failed to fetch',
      'Connection refused',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
    ])('should return true for network error: "%s"', (msg) => {
      expect(isTransientError(new Error(msg))).toBe(true);
    });

    it.each([
      '500 Internal Server Error',
      '502 Bad Gateway',
      '503 Service Unavailable',
      '504 Gateway Timeout',
      '429 Too Many Requests',
    ])('should return true for server error: "%s"', (msg) => {
      expect(isTransientError(new Error(msg))).toBe(true);
    });

    it('should return false for client errors', () => {
      expect(isTransientError(new Error('400 Bad Request'))).toBe(false);
      expect(isTransientError(new Error('404 Not Found'))).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it.each([
      '401 Unauthorized',
      '403 Forbidden',
      'Authentication failed',
      'Token expired',
      'Invalid token',
    ])('should return true for auth error: "%s"', (msg) => {
      expect(isAuthError(new Error(msg))).toBe(true);
    });

    it('should return false for non-auth errors', () => {
      expect(isAuthError(new Error('500 Server Error'))).toBe(false);
      expect(isAuthError(new Error('Network error'))).toBe(false);
    });
  });

  describe('isPermanentError', () => {
    it.each([
      '400 Bad Request',
      '404 Not Found',
      '405 Method Not Allowed',
      '409 Conflict',
      '410 Gone',
      '422 Unprocessable',
      'Validation failed',
      'Invalid input',
      'Malformed data',
      'JSON parse error',
    ])('should return true for permanent error: "%s"', (msg) => {
      expect(isPermanentError(new Error(msg))).toBe(true);
    });

    it('should return false for transient errors', () => {
      expect(isPermanentError(new Error('Network error'))).toBe(false);
      expect(isPermanentError(new Error('500 Internal Server Error'))).toBe(false);
    });
  });

  describe('sanitizeSyncError', () => {
    it('returns rate_limited for 429 errors', () => {
      expect(sanitizeSyncError(new Error('429 Too Many Requests'))).toBe('rate_limited');
    });

    it('returns rate_limited for too-many-requests text without a status code', () => {
      expect(sanitizeSyncError(new Error('Too many requests, slow down'))).toBe(
        'rate_limited'
      );
    });

    it('returns unauthorized for 401/403/auth errors', () => {
      expect(sanitizeSyncError(new Error('401 Unauthorized'))).toBe('unauthorized');
      expect(sanitizeSyncError(new Error('403 Forbidden'))).toBe('unauthorized');
      expect(sanitizeSyncError(new Error('Token expired'))).toBe('unauthorized');
    });

    it('returns validation_failed for 400/422 errors', () => {
      expect(sanitizeSyncError(new Error('400 Bad Request'))).toBe('validation_failed');
      expect(sanitizeSyncError(new Error('422 Unprocessable Entity'))).toBe('validation_failed');
      expect(sanitizeSyncError(new Error('Validation failed: title required'))).toBe(
        'validation_failed'
      );
    });

    it('returns not_found for 404 errors', () => {
      expect(sanitizeSyncError(new Error('404 Not Found'))).toBe('not_found');
    });

    it('returns server_error for 5xx errors', () => {
      expect(sanitizeSyncError(new Error('500 Internal Server Error'))).toBe('server_error');
      expect(sanitizeSyncError(new Error('502 Bad Gateway'))).toBe('server_error');
      expect(sanitizeSyncError(new Error('503 Service Unavailable'))).toBe('server_error');
    });

    it('returns network_error for fetch/timeout failures', () => {
      expect(sanitizeSyncError(new Error('Network request failed'))).toBe('network_error');
      expect(sanitizeSyncError(new Error('Failed to fetch'))).toBe('network_error');
      expect(sanitizeSyncError(new Error('ECONNREFUSED'))).toBe('network_error');
      expect(sanitizeSyncError(new Error('Request timeout'))).toBe('network_error');
    });

    it('returns network_error for PocketBase ClientResponseError status 0', () => {
      // PB SDK reports network faults with `status === 0` and a generic
      // "Something went wrong." message. Detect via the structured field.
      const pbError = Object.assign(new Error('Something went wrong.'), {
        status: 0,
      });
      expect(sanitizeSyncError(pbError)).toBe('network_error');
    });

    it('returns unknown_error for unrecognized errors', () => {
      expect(sanitizeSyncError(new Error('something broke'))).toBe('unknown_error');
    });

    it('NEVER leaks task content from validation error messages', () => {
      // PocketBase 4xx responses echo the request payload — e.g.
      // "failed to validate field 'title': 'My private task title'"
      const result = sanitizeSyncError(
        new Error("400 failed to validate field 'title': 'My private task title'")
      );
      expect(result).toBe('validation_failed');
      expect(result).not.toContain('My private task title');
      expect(result).not.toContain('title');
    });

    it('handles non-Error inputs safely', () => {
      expect(sanitizeSyncError('plain string')).toBe('unknown_error');
      expect(sanitizeSyncError(null)).toBe('unknown_error');
      expect(sanitizeSyncError(undefined)).toBe('unknown_error');
      expect(sanitizeSyncError({ message: 'an object' })).toBe('unknown_error');
    });
  });

  describe('isTransientSyncFailure', () => {
    it('returns true for PocketBase ClientResponseError with status 0 (network fault)', () => {
      // Mirrors the PB SDK shape: Error subclass with a numeric `status` field.
      // status === 0 means the fetch produced no HTTP response.
      const pbError = Object.assign(new Error('Something went wrong.'), {
        status: 0,
        isAbort: false,
      });
      expect(isTransientSyncFailure(pbError)).toBe(true);
    });

    it('returns true for aborted PB SDK requests (status 0, isAbort true)', () => {
      const pbAbort = Object.assign(new Error('The request was aborted.'), {
        status: 0,
        isAbort: true,
      });
      expect(isTransientSyncFailure(pbAbort)).toBe(true);
    });

    it('returns true for known transient text patterns', () => {
      expect(isTransientSyncFailure(new Error('Network error'))).toBe(true);
      expect(isTransientSyncFailure(new Error('Request timeout'))).toBe(true);
      expect(isTransientSyncFailure(new Error('500 Internal Server Error'))).toBe(true);
      expect(isTransientSyncFailure(new Error('502 Bad Gateway'))).toBe(true);
      expect(isTransientSyncFailure(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('returns false for auth errors (still need ERROR-level visibility)', () => {
      expect(isTransientSyncFailure(new Error('401 Unauthorized'))).toBe(false);
      expect(isTransientSyncFailure(new Error('403 Forbidden'))).toBe(false);
      expect(isTransientSyncFailure(new Error('Token expired'))).toBe(false);
    });

    it('returns false for permanent errors (validation, 4xx)', () => {
      expect(isTransientSyncFailure(new Error('400 Bad Request'))).toBe(false);
      expect(isTransientSyncFailure(new Error('404 Not Found'))).toBe(false);
      expect(isTransientSyncFailure(new Error('422 Unprocessable'))).toBe(false);
      expect(isTransientSyncFailure(new Error('Validation failed'))).toBe(false);
    });

    it('returns false for unknown errors without status (preserve ERROR visibility)', () => {
      // An unrecognized error should NOT be silently downgraded. The whole
      // point of this helper is to suppress *known* transient noise; unknown
      // failures must still surface as ERROR so they can be investigated.
      expect(isTransientSyncFailure(new Error('Something exploded'))).toBe(false);
    });

    it('returns false for "Something went wrong" string without status field', () => {
      // Match by `status === 0` only — text alone is too ambiguous to trust.
      expect(isTransientSyncFailure(new Error('Something went wrong.'))).toBe(false);
    });

    it('returns false for non-Error inputs', () => {
      expect(isTransientSyncFailure('string error')).toBe(false);
      expect(isTransientSyncFailure(null)).toBe(false);
      expect(isTransientSyncFailure(undefined)).toBe(false);
      expect(isTransientSyncFailure({ status: 0 })).toBe(false);
    });

    it('ignores non-numeric status values', () => {
      const weird = Object.assign(new Error('weird'), { status: '0' });
      expect(isTransientSyncFailure(weird)).toBe(false);
    });
  });

  describe('parseRetryAfterMs', () => {
    it('parses a numeric Retry-After value (seconds) into milliseconds', () => {
      expect(parseRetryAfterMs('30')).toBe(30_000);
      expect(parseRetryAfterMs('1')).toBe(1_000);
    });

    it('trims whitespace around numeric Retry-After values', () => {
      expect(parseRetryAfterMs(' 30 ')).toBe(30_000);
    });

    it('parses an HTTP-date Retry-After value into ms from now', () => {
      const futureMs = Date.now() + 60_000;
      const httpDate = new Date(futureMs).toUTCString();
      const parsed = parseRetryAfterMs(httpDate);
      // Allow a small tolerance for clock drift during the test.
      expect(parsed).toBeGreaterThan(50_000);
      expect(parsed).toBeLessThan(70_000);
    });

    it('returns null for missing/empty input', () => {
      expect(parseRetryAfterMs(null)).toBeNull();
      expect(parseRetryAfterMs(undefined)).toBeNull();
      expect(parseRetryAfterMs('')).toBeNull();
    });

    it('returns null for garbage input', () => {
      expect(parseRetryAfterMs('not a number or date')).toBeNull();
    });

    it('clamps negative numeric values to 0', () => {
      expect(parseRetryAfterMs('-5')).toBe(0);
    });

    it('clamps past HTTP-date values to 0', () => {
      const pastDate = new Date('2026-01-01T00:00:00.000Z').toUTCString();
      expect(parseRetryAfterMs(pastDate)).toBe(0);
    });
  });

  describe('extractRetryAfterMs', () => {
    it('reads a pre-parsed retryAfterMs folded into the error response body', () => {
      const error = Object.assign(new Error('429 too many requests'), {
        status: 429,
        response: { retryAfterMs: 45_000 },
      });
      expect(extractRetryAfterMs(error)).toBe(45_000);
    });

    it('accepts a zero-delay hint', () => {
      const error = { status: 429, response: { retryAfterMs: 0 } };
      expect(extractRetryAfterMs(error)).toBe(0);
    });

    it('returns null when no retryAfterMs is present', () => {
      const error = Object.assign(new Error('429 too many requests'), {
        status: 429,
        response: { message: 'rate limited' },
      });
      expect(extractRetryAfterMs(error)).toBeNull();
    });

    it('returns null for non-object / missing / non-numeric values', () => {
      expect(extractRetryAfterMs(null)).toBeNull();
      expect(extractRetryAfterMs('429')).toBeNull();
      expect(extractRetryAfterMs({ response: { retryAfterMs: 'soon' } })).toBeNull();
      expect(extractRetryAfterMs({ response: { retryAfterMs: NaN } })).toBeNull();
    });

    it('rejects negative retryAfterMs values from error responses', () => {
      expect(extractRetryAfterMs({ response: { retryAfterMs: -1 } })).toBeNull();
    });
  });
});
