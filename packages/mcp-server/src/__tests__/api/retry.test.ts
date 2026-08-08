import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateBackoffDelay,
  fetchWithRetry,
  formatRetryInfo,
  isRetryableNetworkError,
  isRetryableStatus,
  sleep,
  type RetryConfig,
} from '../../api/retry.js';

const config: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 0,
  maxDelayMs: 10,
  retryableStatuses: [429, 503],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('retry classification', () => {
  it.each([
    'fetch failed',
    'Network unavailable',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'socket hang up',
  ])('accepts retryable network error: %s', (message) => {
    expect(isRetryableNetworkError(new Error(message))).toBe(true);
  });

  it('rejects non-errors and non-network errors', () => {
    expect(isRetryableNetworkError('network')).toBe(false);
    expect(isRetryableNetworkError(new Error('invalid input'))).toBe(false);
  });

  it('uses the configured HTTP status allowlist', () => {
    expect(isRetryableStatus(503, config)).toBe(true);
    expect(isRetryableStatus(400, config)).toBe(false);
  });
});

describe('retry timing', () => {
  it('applies exponential backoff, jitter, and the maximum', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const timed: RetryConfig = { ...config, baseDelayMs: 100, maxDelayMs: 250 };

    expect(calculateBackoffDelay(0, timed)).toBe(125);
    expect(calculateBackoffDelay(2, timed)).toBe(250);
  });

  it('resolves sleep after the requested delay', async () => {
    vi.useFakeTimers();
    const pending = sleep(50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBeUndefined();
  });
});

describe('fetchWithRetry', () => {
  it('returns the first successful response', async () => {
    const response = new Response('ok', { status: 200 });
    const fetchFn = vi.fn(async () => response);

    await expect(fetchWithRetry(fetchFn, config)).resolves.toBe(response);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries an allowed status and then succeeds', async () => {
    const retry = new Response('retry', { status: 503 });
    const success = new Response('ok', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValueOnce(retry).mockResolvedValueOnce(success);

    await expect(fetchWithRetry(fetchFn, config)).resolves.toBe(success);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns the final retryable response after exhausting retries', async () => {
    const response = new Response('busy', { status: 503 });
    const fetchFn = vi.fn(async () => response);

    await expect(fetchWithRetry(fetchFn, config)).resolves.toBe(response);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('retries a network error and then succeeds', async () => {
    const response = new Response('ok', { status: 200 });
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(response);

    await expect(fetchWithRetry(fetchFn, config)).resolves.toBe(response);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permanent or non-Error failure', async () => {
    const permanent = vi.fn().mockRejectedValue(new Error('invalid input'));
    const unknown = vi.fn().mockRejectedValue('bad value');

    await expect(fetchWithRetry(permanent, config)).rejects.toThrow('invalid input');
    await expect(fetchWithRetry(unknown, config)).rejects.toThrow('bad value');
    expect(permanent).toHaveBeenCalledTimes(1);
    expect(unknown).toHaveBeenCalledTimes(1);
  });

  it('throws the last network error after exhausting retries', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('fetch failed'));

    await expect(fetchWithRetry(fetchFn, config)).rejects.toThrow('fetch failed');
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

describe('formatRetryInfo', () => {
  it('formats zero, singular, and plural attempts', () => {
    expect(formatRetryInfo(0, config)).toBe('');
    expect(formatRetryInfo(1, config)).toContain('Retried 1 time before failing.');
    expect(formatRetryInfo(2, config)).toContain('Retried 2 times before failing.');
  });
});
