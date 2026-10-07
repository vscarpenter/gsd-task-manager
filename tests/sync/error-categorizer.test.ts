/**
 * Tests for error categorizer - classifies sync errors for appropriate handling
 */

import { describe, it, expect } from 'vitest';
import {
  isTransientError,
  isAuthError,
} from '@/lib/sync/error-categorizer';

describe('error-categorizer', () => {
  describe('isTransientError - network errors', () => {
    it('should detect network error', () => {
      const error = new Error('Network error occurred');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect timeout error', () => {
      const error = new Error('Request timeout');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect fetch error', () => {
      const error = new Error('Fetch failed');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect connection error', () => {
      const error = new Error('Connection refused');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect ECONNREFUSED', () => {
      const error = new Error('ECONNREFUSED');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect ENOTFOUND', () => {
      const error = new Error('ENOTFOUND');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect ETIMEDOUT', () => {
      const error = new Error('ETIMEDOUT');
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe('isTransientError - server errors (5xx)', () => {
    it('should detect 500 Internal Server Error', () => {
      const error = new Error('500 Internal Server Error');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect 502 Bad Gateway', () => {
      const error = new Error('502 Bad Gateway');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect 503 Service Unavailable', () => {
      const error = new Error('503 Service Unavailable');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect 504 Gateway Timeout', () => {
      const error = new Error('504 Gateway Timeout');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect internal server error text', () => {
      const error = new Error('Internal server error');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect bad gateway text', () => {
      const error = new Error('Bad gateway');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect service unavailable text', () => {
      const error = new Error('Service unavailable');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect gateway timeout text', () => {
      const error = new Error('Gateway timeout');
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe('isTransientError - rate limiting', () => {
    it('should detect 429 Too Many Requests', () => {
      const error = new Error('429 Too Many Requests');
      expect(isTransientError(error)).toBe(true);
    });

    it('should detect too many requests text', () => {
      const error = new Error('Too many requests');
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe('isTransientError - non-transient errors', () => {
    it('should not classify 400 as transient', () => {
      const error = new Error('400 Bad Request');
      expect(isTransientError(error)).toBe(false);
    });

    it('should not classify 401 as transient', () => {
      const error = new Error('401 Unauthorized');
      expect(isTransientError(error)).toBe(false);
    });

    it('should not classify 404 as transient', () => {
      const error = new Error('404 Not Found');
      expect(isTransientError(error)).toBe(false);
    });

    it('should not classify validation errors as transient', () => {
      const error = new Error('Validation failed');
      expect(isTransientError(error)).toBe(false);
    });
  });

  describe('isAuthError - authentication errors', () => {
    it('should detect 401 Unauthorized', () => {
      const error = new Error('401 Unauthorized');
      expect(isAuthError(error)).toBe(true);
    });

    it('should detect 403 Forbidden', () => {
      const error = new Error('403 Forbidden');
      expect(isAuthError(error)).toBe(true);
    });

    it('should detect unauthorized text', () => {
      const error = new Error('Unauthorized access');
      expect(isAuthError(error)).toBe(true);
    });

    it('should detect forbidden text', () => {
      const error = new Error('Forbidden resource');
      expect(isAuthError(error)).toBe(true);
    });

    it('should detect authentication text', () => {
      const error = new Error('Authentication failed');
      expect(isAuthError(error)).toBe(true);
    });

    it('should detect token expired', () => {
      const error = new Error('Token expired');
      expect(isAuthError(error)).toBe(true);
    });

    it('should detect invalid token', () => {
      const error = new Error('Invalid token');
      expect(isAuthError(error)).toBe(true);
    });
  });

  describe('isAuthError - non-auth errors', () => {
    it('should not classify 400 as auth error', () => {
      const error = new Error('400 Bad Request');
      expect(isAuthError(error)).toBe(false);
    });

    it('should not classify 404 as auth error', () => {
      const error = new Error('404 Not Found');
      expect(isAuthError(error)).toBe(false);
    });

    it('should not classify 500 as auth error', () => {
      const error = new Error('500 Internal Server Error');
      expect(isAuthError(error)).toBe(false);
    });

    it('should not classify network errors as auth error', () => {
      const error = new Error('Network error');
      expect(isAuthError(error)).toBe(false);
    });
  });

  describe('case insensitivity', () => {
    it('should detect errors regardless of case', () => {
      expect(isAuthError(new Error('UNAUTHORIZED'))).toBe(true);
      expect(isAuthError(new Error('UnAuthorized'))).toBe(true);
      expect(isTransientError(new Error('NETWORK ERROR'))).toBe(true);
      expect(isTransientError(new Error('Network Error'))).toBe(true);
    });
  });

  describe('retry-able vs non-retry-able classification', () => {
    it('should classify transient errors as retry-able', () => {
      const transientErrors = [
        new Error('Network error'),
        new Error('500 Internal Server Error'),
        new Error('503 Service Unavailable'),
        new Error('429 Too Many Requests'),
        new Error('Timeout'),
      ];

      transientErrors.forEach(error => {
        expect(isTransientError(error)).toBe(true);
      });
    });

    it('should classify auth errors as non-retry-able without token refresh', () => {
      const authErrors = [
        new Error('401 Unauthorized'),
        new Error('403 Forbidden'),
        new Error('Token expired'),
      ];

      authErrors.forEach(error => {
        expect(isAuthError(error)).toBe(true);
      });
    });
  });
});
