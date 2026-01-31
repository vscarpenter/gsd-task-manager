/**
 * Tests for push-handler - local-to-remote sync operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { pushLocalChanges } from '@/lib/sync/engine/push-handler';
import { getSyncQueue } from '@/lib/sync/queue';
import {
  createMockSyncConfig,
  createMockTask,
  createMockPushResponse,
  mockConsole,
} from '../fixtures';
import type { PushContext } from '@/lib/sync/engine/push-handler';
import type { CryptoManager } from '@/lib/sync/crypto';
import type { SyncApiClient } from '@/lib/sync/api-client';

describe('pushLocalChanges', () => {
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;
  let mockCrypto: CryptoManager;
  let mockApi: SyncApiClient;
  let context: PushContext;
  let queue: ReturnType<typeof getSyncQueue>;

  beforeEach(async () => {
    db = getDb();
    consoleMock = mockConsole();
    queue = getSyncQueue();

    // Clear database
    await db.delete();
    await db.open();

    // Create mock crypto manager
    mockCrypto = {
      isInitialized: vi.fn(() => true),
      encrypt: vi.fn(async () => ({
        ciphertext: 'encrypted-data',
        nonce: 'test-nonce',
      })),
      decrypt: vi.fn(async () => JSON.stringify(createMockTask())),
      hash: vi.fn(async () => 'checksum-abc123'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Create mock API client
    mockApi = {
      setToken: vi.fn(),
      push: vi.fn(async () => createMockPushResponse()),
      pull: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    context = {
      crypto: mockCrypto,
      api: mockApi,
    };
  });

  afterEach(async () => {
    consoleMock.restore();
    await db.delete();
    vi.clearAllMocks();
  });

  describe('local-to-remote sync flow', () => {
    it('should push pending operations to server', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1', title: 'Test Task' });

      // Add operation to queue
      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      const result = await pushLocalChanges(config, context);

      expect(mockApi.push).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: config.deviceId,
          operations: expect.arrayContaining([
            expect.objectContaining({
              type: 'create',
              taskId: 'task-1',
            }),
          ]),
        })
      );
      expect(result.accepted).toEqual(['task-1']);
    });

    it('should encrypt task payloads before pushing', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      await pushLocalChanges(config, context);

      expect(mockCrypto.encrypt).toHaveBeenCalledWith(JSON.stringify(task));
      expect(mockCrypto.hash).toHaveBeenCalledWith(JSON.stringify(task));
    });

    it('should include encrypted blob and nonce in operations', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockCrypto.encrypt).mockResolvedValue({
        ciphertext: 'encrypted-blob',
        nonce: 'nonce-123',
      });

      vi.mocked(mockCrypto.hash).mockResolvedValue('checksum-xyz');

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      await pushLocalChanges(config, context);

      expect(mockApi.push).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: expect.arrayContaining([
            expect.objectContaining({
              encryptedBlob: 'encrypted-blob',
              nonce: 'nonce-123',
              checksum: 'checksum-xyz',
            }),
          ]),
        })
      );
    });

    it('should send vector clocks with operations', async () => {
      const config = createMockSyncConfig({ vectorClock: { 'device-456': 5 } });
      const task = createMockTask({ id: 'task-1' });
      const taskClock = { 'device-456': 3 };

      await queue.enqueue('create', 'task-1', task, taskClock);

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      await pushLocalChanges(config, context);

      expect(mockApi.push).toHaveBeenCalledWith(
        expect.objectContaining({
          clientVectorClock: { 'device-456': 5 },
          operations: expect.arrayContaining([
            expect.objectContaining({
              vectorClock: taskClock,
            }),
          ]),
        })
      );
    });

    it('should handle delete operations without payload', async () => {
      const config = createMockSyncConfig();

      await queue.enqueue('delete', 'task-1', null, { 'device-456': 2 });

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      await pushLocalChanges(config, context);

      expect(mockApi.push).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: expect.arrayContaining([
            expect.objectContaining({
              type: 'delete',
              taskId: 'task-1',
              vectorClock: { 'device-456': 2 },
            }),
          ]),
        })
      );

      // Should not encrypt for delete operations
      expect(mockCrypto.encrypt).not.toHaveBeenCalled();
    });

    it('should return early when no pending operations', async () => {
      const config = createMockSyncConfig();

      const result = await pushLocalChanges(config, context);

      expect(mockApi.push).not.toHaveBeenCalled();
      expect(result.accepted).toEqual([]);
      expect(result.rejected).toEqual([]);
    });
  });

  describe('change detection and batching', () => {
    it('should batch multiple operations in single push', async () => {
      const config = createMockSyncConfig();
      const task1 = createMockTask({ id: 'task-1' });
      const task2 = createMockTask({ id: 'task-2' });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _task3 = createMockTask({ id: 'task-3' });

      await queue.enqueue('create', 'task-1', task1, {});
      await queue.enqueue('update', 'task-2', task2, {});
      await queue.enqueue('delete', 'task-3', null, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1', 'task-2', 'task-3'] })
      );

      await pushLocalChanges(config, context);

      expect(mockApi.push).toHaveBeenCalledTimes(1);
      expect(mockApi.push).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: expect.arrayContaining([
            expect.objectContaining({ type: 'create', taskId: 'task-1' }),
            expect.objectContaining({ type: 'update', taskId: 'task-2' }),
            expect.objectContaining({ type: 'delete', taskId: 'task-3' }),
          ]),
        })
      );
    });

    it('should handle multiple operations for same task', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      // Queue multiple operations for same task
      await queue.enqueue('create', 'task-1', task, {});
      await queue.enqueue('update', 'task-1', { ...task, title: 'Updated' }, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      await pushLocalChanges(config, context);

      // Both operations should be sent
      const pushCall = vi.mocked(mockApi.push).mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const task1Ops = pushCall.operations.filter((op: any) => op.taskId === 'task-1');
      expect(task1Ops).toHaveLength(2);
    });

    it('should remove all queue items for accepted tasks', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      // Queue multiple operations for same task
      await queue.enqueue('create', 'task-1', task, {});
      await queue.enqueue('update', 'task-1', { ...task, title: 'Updated' }, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      await pushLocalChanges(config, context);

      // All operations for task-1 should be removed
      const remaining = await queue.getForTask('task-1');
      expect(remaining).toHaveLength(0);
    });
  });

  describe('push retry on failure', () => {
    it('should increment retry count for rejected operations', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      const queueItems = await queue.getPending();
      const queueId = queueItems[0].id;

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({
          rejected: [
            {
              taskId: 'task-1',
              reason: 'validation_error',
              details: 'Invalid task data',
            },
          ],
        })
      );

      await pushLocalChanges(config, context);

      const updatedItem = await db.syncQueue.get(queueId);
      expect(updatedItem?.retryCount).toBe(1);
    });

    it('should keep rejected operations in queue', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({
          rejected: [
            {
              taskId: 'task-1',
              reason: 'version_mismatch',
              details: 'Version conflict',
            },
          ],
        })
      );

      await pushLocalChanges(config, context);

      const remaining = await queue.getPending();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].taskId).toBe('task-1');
    });

    it('should throw error when push API call fails', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      const networkError = new Error('Network error');
      vi.mocked(mockApi.push).mockRejectedValue(networkError);

      await expect(pushLocalChanges(config, context)).rejects.toThrow('Network error');
    });

    it('should not remove operations when push fails', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockRejectedValue(new Error('Server error'));

      await expect(pushLocalChanges(config, context)).rejects.toThrow();

      const remaining = await queue.getPending();
      expect(remaining).toHaveLength(1);
    });
  });

  describe('conflict handling', () => {
    it('should remove conflicted operations from queue', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('update', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({
          conflicts: [
            {
              taskId: 'task-1',
              local: task,
              remote: createMockTask({ id: 'task-1', title: 'Remote Version' }),
              localClock: { 'device-456': 2 },
              remoteClock: { 'device-789': 3 },
            },
          ],
        })
      );

      await pushLocalChanges(config, context);

      const remaining = await queue.getForTask('task-1');
      expect(remaining).toHaveLength(0);
    });

    it('should handle multiple conflicts', async () => {
      const config = createMockSyncConfig();
      const task1 = createMockTask({ id: 'task-1' });
      const task2 = createMockTask({ id: 'task-2' });

      await queue.enqueue('update', 'task-1', task1, {});
      await queue.enqueue('update', 'task-2', task2, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({
          conflicts: [
            {
              taskId: 'task-1',
              local: task1,
              remote: createMockTask({ id: 'task-1' }),
              localClock: {},
              remoteClock: {},
            },
            {
              taskId: 'task-2',
              local: task2,
              remote: createMockTask({ id: 'task-2' }),
              localClock: {},
              remoteClock: {},
            },
          ],
        })
      );

      await pushLocalChanges(config, context);

      expect(await queue.getForTask('task-1')).toHaveLength(0);
      expect(await queue.getForTask('task-2')).toHaveLength(0);
    });

    it('should remove all queue items for conflicted tasks', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      // Queue multiple operations for same task
      await queue.enqueue('create', 'task-1', task, {});
      await queue.enqueue('update', 'task-1', { ...task, title: 'Updated' }, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({
          conflicts: [
            {
              taskId: 'task-1',
              local: task,
              remote: createMockTask({ id: 'task-1' }),
              localClock: {},
              remoteClock: {},
            },
          ],
        })
      );

      await pushLocalChanges(config, context);

      const remaining = await queue.getForTask('task-1');
      expect(remaining).toHaveLength(0);
    });
  });

  describe('optimistic updates', () => {
    it('should remove accepted operations from queue immediately', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      await pushLocalChanges(config, context);

      const remaining = await queue.getPending();
      expect(remaining).toHaveLength(0);
    });

    it('should handle partial acceptance', async () => {
      const config = createMockSyncConfig();
      const task1 = createMockTask({ id: 'task-1' });
      const task2 = createMockTask({ id: 'task-2' });
      const task3 = createMockTask({ id: 'task-3' });

      await queue.enqueue('create', 'task-1', task1, {});
      await queue.enqueue('create', 'task-2', task2, {});
      await queue.enqueue('create', 'task-3', task3, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({
          accepted: ['task-1', 'task-3'],
          rejected: [
            {
              taskId: 'task-2',
              reason: 'validation_error',
              details: 'Invalid data',
            },
          ],
        })
      );

      await pushLocalChanges(config, context);

      const remaining = await queue.getPending();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].taskId).toBe('task-2');
    });

    it('should verify queue cleanup after acceptance', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      const initialCount = await queue.getPendingCount();
      expect(initialCount).toBe(1);

      await pushLocalChanges(config, context);

      const finalCount = await queue.getPendingCount();
      expect(finalCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should continue processing when encryption fails for one task', async () => {
      const config = createMockSyncConfig();
      const task1 = createMockTask({ id: 'task-1' });
      const task2 = createMockTask({ id: 'task-2' });

      await queue.enqueue('create', 'task-1', task1, {});
      await queue.enqueue('create', 'task-2', task2, {});

      vi.mocked(mockCrypto.encrypt)
        .mockRejectedValueOnce(new Error('Encryption failed'))
        .mockResolvedValueOnce({ ciphertext: 'encrypted', nonce: 'nonce' });

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-2'] })
      );

      await pushLocalChanges(config, context);

      // Should still push exactly one task (the one that encrypted successfully)
      const pushArgs = vi.mocked(mockApi.push).mock.calls[0]?.[0];
      expect(pushArgs).toEqual(
        expect.objectContaining({
          operations: expect.arrayContaining([
            expect.objectContaining({
              taskId: expect.stringMatching(/^task-[12]$/),
            }),
          ]),
        })
      );
      expect(pushArgs?.operations).toHaveLength(1);
    });

    it('should handle empty accepted array', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: [] })
      );

      await pushLocalChanges(config, context);

      // Task should remain in queue
      const remaining = await queue.getPending();
      expect(remaining).toHaveLength(1);
    });

    it('should handle server accepting unknown task ID', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      // Server accepts a task we didn't send
      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1', 'unknown-task'] })
      );

      // Should not throw error
      await expect(pushLocalChanges(config, context)).resolves.toBeDefined();
    });
  });

  describe('return value', () => {
    it('should return push response with accepted tasks', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ accepted: ['task-1'] })
      );

      const result = await pushLocalChanges(config, context);

      expect(result.accepted).toEqual(['task-1']);
    });

    it('should return rejected operations', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      const rejection = {
        taskId: 'task-1',
        reason: 'validation_error' as const,
        details: 'Invalid data',
      };

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ rejected: [rejection] })
      );

      const result = await pushLocalChanges(config, context);

      expect(result.rejected).toEqual([rejection]);
    });

    it('should return conflicts', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('update', 'task-1', task, {});

      const conflict = {
        taskId: 'task-1',
        local: task,
        remote: createMockTask({ id: 'task-1' }),
        localClock: {},
        remoteClock: {},
      };

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({ conflicts: [conflict] })
      );

      const result = await pushLocalChanges(config, context);

      expect(result.conflicts).toEqual([conflict]);
    });

    it('should return server vector clock', async () => {
      const config = createMockSyncConfig();
      const task = createMockTask({ id: 'task-1' });

      await queue.enqueue('create', 'task-1', task, {});

      const serverClock = { 'device-456': 10, 'device-789': 5 };

      vi.mocked(mockApi.push).mockResolvedValue(
        createMockPushResponse({
          accepted: ['task-1'],
          serverVectorClock: serverClock,
        })
      );

      const result = await pushLocalChanges(config, context);

      expect(result.serverVectorClock).toEqual(serverClock);
    });

    it('should return empty result when no operations', async () => {
      const config = createMockSyncConfig();

      const result = await pushLocalChanges(config, context);

      expect(result.accepted).toEqual([]);
      expect(result.rejected).toEqual([]);
      expect(result.conflicts).toEqual([]);
      expect(result.serverVectorClock).toEqual({});
    });
  });
});
