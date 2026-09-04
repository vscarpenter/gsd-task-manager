import { describe, expect, it } from 'vitest';
import { classifyRemoteDeletion, isPendingSyncQueueItem } from '@/lib/sync/queue';
import type { SyncQueueItem } from '@/lib/sync/types';

function queueItem(status?: SyncQueueItem['status'], id = `queue-${status ?? 'legacy'}`): SyncQueueItem {
  return {
    id,
    taskId: 'task-1',
    operation: 'update',
    timestamp: 1,
    retryCount: 0,
    payload: null,
    status,
  };
}

describe('isPendingSyncQueueItem', () => {
  it('treats legacy rows without a status as pending', () => {
    expect(isPendingSyncQueueItem(queueItem(undefined))).toBe(true);
  });

  it('only treats explicit pending rows as pending', () => {
    expect(isPendingSyncQueueItem(queueItem('pending'))).toBe(true);
    expect(isPendingSyncQueueItem(queueItem('failed'))).toBe(false);
    expect(
      isPendingSyncQueueItem({
        ...queueItem('pending'),
        status: 'cancelled',
      } as unknown as SyncQueueItem)
    ).toBe(false);
  });
});

describe('classifyRemoteDeletion', () => {
  it('protects a task whose queued change can still be pushed', () => {
    expect(classifyRemoteDeletion([queueItem('pending')])).toEqual({
      verdict: 'protect',
      staleRowIds: [],
    });
  });

  it('treats a legacy statusless row as still push-eligible', () => {
    expect(classifyRemoteDeletion([queueItem(undefined)])).toEqual({
      verdict: 'protect',
      staleRowIds: [],
    });
  });

  it('applies an ordinary cross-device deletion when nothing is queued', () => {
    expect(classifyRemoteDeletion([])).toEqual({ verdict: 'apply', staleRowIds: [] });
  });

  // The heart of the regression: a retry-exhausted row can never be pushed, so
  // it must not shield the task from a deletion it will never contest.
  it('abandons a task whose only row has exhausted its retries', () => {
    expect(classifyRemoteDeletion([queueItem('failed', 'row-f')])).toEqual({
      verdict: 'abandon',
      staleRowIds: ['row-f'],
    });
  });

  it('prefers a fresh pending row over a stale exhausted one', () => {
    expect(
      classifyRemoteDeletion([queueItem('failed', 'row-f'), queueItem('pending', 'row-p')])
    ).toEqual({ verdict: 'protect', staleRowIds: [] });
  });

  // A row carrying a status outside the union neither protects nor abandons,
  // but it must still be released — otherwise it outlives the deleted task and
  // becomes the next permanent shield.
  it('releases a row whose status is outside the known union', () => {
    const cancelled = { ...queueItem('pending', 'row-c'), status: 'cancelled' } as unknown as SyncQueueItem;

    expect(classifyRemoteDeletion([cancelled])).toEqual({
      verdict: 'apply',
      staleRowIds: ['row-c'],
    });
  });
});
