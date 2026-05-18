import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import { importTasks } from '@/lib/tasks/import-export';
import { getSyncQueue } from '@/lib/sync/queue';
import type { ImportPayload, TaskRecord } from '@/lib/types';

function makeTask(id: string, title: string): TaskRecord {
  return {
    id,
    title,
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
  };
}

describe('importTasks replace mode with sync enabled', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    await db.syncMetadata.clear();
    await db.syncMetadata.put({
      key: 'sync_config',
      enabled: true,
      userId: 'user-1',
      deviceId: 'dev-1',
      deviceName: 'Test',
      email: null,
      provider: null,
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
    });
  });

  it('enqueues delete operations for local tasks absent from the imported payload', async () => {
    const db = getDb();
    await db.tasks.bulkAdd([makeTask('keep-1', 'Keep'), makeTask('remove-1', 'Removed')]);

    const payload: ImportPayload = {
      tasks: [makeTask('keep-1', 'Keep'), makeTask('new-1', 'New')],
      exportedAt: '2026-05-18T00:00:00.000Z',
      version: '1.0.0',
    };

    await importTasks(payload, 'replace');

    const queue = await getSyncQueue().getPending();
    const deletes = queue.filter(q => q.operation === 'delete').map(q => q.taskId);
    const creates = queue.filter(q => q.operation === 'create').map(q => q.taskId);

    expect(deletes).toEqual(['remove-1']);
    expect(creates.sort()).toEqual(['keep-1', 'new-1']);
  });

  it('does not enqueue deletes when sync is disabled', async () => {
    const db = getDb();
    await db.syncMetadata.put({
      key: 'sync_config',
      enabled: false,
      userId: null,
      deviceId: 'dev-1',
      deviceName: 'Test',
      email: null,
      provider: null,
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
    });
    await db.tasks.bulkAdd([makeTask('remove-1', 'Removed')]);

    await importTasks(
      {
        tasks: [makeTask('new-1', 'New')],
        exportedAt: '2026-05-18T00:00:00.000Z',
        version: '1.0.0',
      },
      'replace',
    );

    const queue = await getSyncQueue().getPending();
    expect(queue).toHaveLength(0);
  });
});
