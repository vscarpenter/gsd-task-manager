import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  sanitizePocketBaseWriteError,
  WriteRateLimiter,
} from '../../write-ops/write-rate-limiter.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('sanitizePocketBaseWriteError', () => {
  it.each([
    [0, 'network_error'],
    [400, 'validation_failed'],
    [401, 'authentication_failed'],
    [403, 'authentication_failed'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'validation_failed'],
    [429, 'rate_limited'],
    [418, 'write_failed'],
    [503, 'backend_unavailable'],
  ])('maps status %i to the stable %s code', (status, code) => {
    expect(sanitizePocketBaseWriteError({ status })).toMatchObject({
      code,
      rateLimited: status === 429,
      retryAfterMs: null,
      status,
    });
  });

  it('does not expose raw error content when no numeric status is available', () => {
    expect(sanitizePocketBaseWriteError(new Error('secret task content'))).toEqual({
      code: 'write_failed',
      rateLimited: false,
      retryAfterMs: null,
    });
    expect(sanitizePocketBaseWriteError({ status: '429' })).toEqual({
      code: 'write_failed',
      rateLimited: false,
      retryAfterMs: null,
    });
    expect(sanitizePocketBaseWriteError(null)).toEqual({
      code: 'write_failed',
      rateLimited: false,
      retryAfterMs: null,
    });
  });

  it('reads bounded retry delays from direct values and response headers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T15:00:00.000Z'));
    const future = 'Mon, 10 Aug 2026 15:00:03 GMT';

    expect(sanitizePocketBaseWriteError({ status: 429, retryAfterMs: -20 }).retryAfterMs)
      .toBe(0);
    expect(sanitizePocketBaseWriteError({
      status: 429,
      response: { headers: { get: () => '1.5' } },
    }).retryAfterMs).toBe(1500);
    expect(sanitizePocketBaseWriteError({
      status: 429,
      response: { headers: { 'retry-after': '2' } },
    }).retryAfterMs).toBe(2000);
    expect(sanitizePocketBaseWriteError({
      status: 429,
      response: { retryAfterMs: 2500 },
    }).retryAfterMs).toBe(2500);
    expect(sanitizePocketBaseWriteError({
      status: 429,
      response: { headers: { 'Retry-After': future } },
    }).retryAfterMs).toBe(3000);
    expect(sanitizePocketBaseWriteError({
      status: 429,
      response: { headers: { 'retry-after': 'invalid' } },
      originalError: { response: { headers: { 'Retry-After': '4' } } },
    }).retryAfterMs).toBe(4000);
  });

  it('rejects empty, non-finite, malformed, and non-object retry metadata', () => {
    expect(sanitizePocketBaseWriteError({ status: 429, retryAfterMs: Number.POSITIVE_INFINITY }).retryAfterMs)
      .toBeNull();
    expect(sanitizePocketBaseWriteError({ status: 429, retryAfterMs: '' }).retryAfterMs)
      .toBeNull();
    expect(sanitizePocketBaseWriteError({
      status: 429,
      response: { headers: 'not-headers' },
    }).retryAfterMs).toBeNull();
  });
});

describe('WriteRateLimiter', () => {
  it('serializes writes and enforces the 100ms interval', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T15:00:00.000Z'));
    const limiter = new WriteRateLimiter();
    const calls: string[] = [];

    const first = limiter.run(async () => {
      calls.push('first');
      return 1;
    });
    const second = limiter.run(async () => {
      calls.push('second');
      return 2;
    });

    await expect(first).resolves.toBe(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(calls).toEqual(['first']);
    await vi.advanceTimersByTimeAsync(1);
    await expect(second).resolves.toBe(2);
    expect(calls).toEqual(['first', 'second']);
  });

  it('retries one 429 using the server delay and counts it', async () => {
    vi.useFakeTimers();
    const limiter = new WriteRateLimiter();
    const operation = vi.fn()
      .mockRejectedValueOnce({ status: 429, retryAfterMs: 25 })
      .mockResolvedValueOnce('ok');

    const result = limiter.run(operation);
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(limiter.getRateLimitCount()).toBe(1);
  });

  it('uses the default delay when 429 has no Retry-After', async () => {
    vi.useFakeTimers();
    const limiter = new WriteRateLimiter();
    const operation = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce('ok');

    const result = limiter.run(operation);
    await vi.advanceTimersByTimeAsync(199);
    expect(operation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe('ok');
  });

  it('does not retry non-rate-limit failures or a second 429', async () => {
    const limiter = new WriteRateLimiter();
    const validationError = { status: 422 };
    const validationOperation = vi.fn().mockRejectedValue(validationError);

    await expect(limiter.run(validationOperation)).rejects.toBe(validationError);
    expect(validationOperation).toHaveBeenCalledOnce();

    const rateLimited = new WriteRateLimiter();
    const persistent429 = { status: 429, retryAfterMs: 0 };
    const rateLimitedOperation = vi.fn().mockRejectedValue(persistent429);
    await expect(rateLimited.run(rateLimitedOperation)).rejects.toBe(persistent429);
    expect(rateLimitedOperation).toHaveBeenCalledTimes(2);
    expect(rateLimited.getRateLimitCount()).toBe(1);
  });
});
