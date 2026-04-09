import { describe, it, expect } from 'vitest';
import {
  categorizeError,
  isTransientError,
  isAuthError,
  isPermanentError,
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
});
