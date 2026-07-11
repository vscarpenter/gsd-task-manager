import { describe, expect, it } from 'vitest';
import { isPendingSyncQueueItem } from '@/lib/sync/queue';
import type { SyncQueueItem } from '@/lib/sync/types';

function queueItem(status?: SyncQueueItem['status']): SyncQueueItem {
  return {
    id: `queue-${status ?? 'legacy'}`,
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
