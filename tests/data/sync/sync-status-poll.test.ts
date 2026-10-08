import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every logger context gets the same spy, tagged with its context, so a test
// can prove a poll failure went through SYNC_STATUS and not a neighbour. The
// module creates its logger once at import, and Vitest 5 clears every mock's
// calls before each test by default, so that createLogger call is gone by the
// time a test runs. The context is checked on the warn call instead.
const { warn, createLogger } = vi.hoisted(() => {
  const warn = vi.fn();
  const createLogger = vi.fn((context: string) => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: (message: string, metadata?: Record<string, unknown>) => warn(context, message, metadata),
    error: vi.fn(),
  }));
  return { warn, createLogger };
});

vi.mock('@/lib/logger', () => ({ createLogger }));

import { guardPoll } from '@/lib/sync/sync-status-poll';

describe('guardPoll', () => {
  beforeEach(() => {
    warn.mockClear();
  });

  it('should_log_a_rejected_poll_through_SYNC_STATUS_and_resolve', async () => {
    const poll = guardPoll('coordinator', async () => {
      throw new Error('IndexedDB is closed');
    });

    await expect(poll()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('SYNC_STATUS', 'Sync status poll failed', {
      poll: 'coordinator',
      errorType: 'Error',
      errorMessage: 'IndexedDB is closed',
    });
  });

  it('should_catch_a_poll_that_throws_before_it_returns_a_promise', async () => {
    const poll = guardPoll('lastSync', () => {
      throw new TypeError('getStatus is not a function');
    });

    await expect(poll()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('SYNC_STATUS', 'Sync status poll failed', {
      poll: 'lastSync',
      errorType: 'TypeError',
      errorMessage: 'getStatus is not a function',
    });
  });

  it('should_describe_a_thrown_non_error_value', async () => {
    const poll = guardPoll('pendingCount', () => Promise.reject('quota exceeded'));

    await poll();

    expect(warn).toHaveBeenCalledWith('SYNC_STATUS', 'Sync status poll failed', {
      poll: 'pendingCount',
      errorType: 'UnknownError',
      errorMessage: 'quota exceeded',
    });
  });

  it('should_run_the_poll_and_log_nothing_when_it_succeeds', async () => {
    const run = vi.fn().mockResolvedValue(undefined);

    await guardPoll('enabled', run)();

    expect(run).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });
});
