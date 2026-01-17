/**
 * Tests for pull-handler - remote-to-local sync operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { pullRemoteChanges } from '@/lib/sync/engine/pull-handler';
import {
  createMockSyncConfig,
  createMockTask,
  createMockEncryptedTaskBlob,
  createMockPullResponse,
  mockConsole,
} from '../fixtures';
import type { PullContext } from '@/lib/sync/engine/pull-handler';
import type { CryptoManager } from '@/lib/sync/crypto';
import type { SyncApiClient } from '@/lib/sync/api-client';

describe('pullRemoteChanges', () => {
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;
  let mockCrypto: CryptoManager;
  let mockApi: SyncApiClient;
  let context: PullContext;

  beforeEach(async () => {
    db = getDb();
    consoleMock = mockConsole();

    // Clear database
    await db.delete();
    await db.open();

    // Create mock crypto manager
    mockCrypto = {
      isInitialized: vi.fn(() => true),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      encrypt: vi.fn(async (_data: string) => ({
        ciphertext: 'encrypted',
        nonce: 'nonce',
      })),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      decrypt: vi.fn(async (_ciphertext: string, _nonce: string) => {
        // Return a valid task JSON
        const task = createMockTask({ id: 'decrypted-task' });
        return JSON.stringify(task);
      }),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      hash: vi.fn(async (_data: string) => 'hash'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Create mock API client
    mockApi = {
      setToken: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(async () => createMockPullResponse()),
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

  describe('remote-to-local sync flow', () => {
    it('should pull tasks from server and save to local database', async () => {
      const config = createMockSyncConfig();
      const remoteTask = createMockTask({ id: 'remote-task-1', title: 'Remote Task' });
      
      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({
              id: 'remote-task-1',
              updatedAt: Date.now(),
            }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(remoteTask));

      const result = await pullRemoteChanges(config, context);

      expect(result.tasks).toHaveLength(1);
      
      const savedTask = await db.tasks.get('remote-task-1');
      expect(savedTask).toBeDefined();
      expect(savedTask?.title).toBe('Remote Task');
    });

    it('should decrypt encrypted task blobs', async () => {
      const config = createMockSyncConfig();
      const encryptedBlob = createMockEncryptedTaskBlob({
        id: 'encrypted-task',
        encryptedBlob: 'encrypted-data',
        nonce: 'test-nonce',
      });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({ tasks: [encryptedBlob] })
      );

      await pullRemoteChanges(config, context);

      expect(mockCrypto.decrypt).toHaveBeenCalledWith('encrypted-data', 'test-nonce');
    });

    it('should merge vector clocks when saving tasks', async () => {
      const config = createMockSyncConfig({ vectorClock: { 'device-1': 1 } });
      const remoteTask = createMockTask({ id: 'task-1' });
      
      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({
              id: 'task-1',
              vectorClock: { 'device-2': 2 },
            }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(remoteTask));

      await pullRemoteChanges(config, context);

      const savedTask = await db.tasks.get('task-1');
      expect(savedTask?.vectorClock).toEqual({ 'device-2': 2 });
    });

    it('should handle multiple tasks in single pull', async () => {
      const config = createMockSyncConfig();
      const task1 = createMockTask({ id: 'task-1', title: 'Task 1' });
      const task2 = createMockTask({ id: 'task-2', title: 'Task 2' });
      const task3 = createMockTask({ id: 'task-3', title: 'Task 3' });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({ id: 'task-1' }),
            createMockEncryptedTaskBlob({ id: 'task-2' }),
            createMockEncryptedTaskBlob({ id: 'task-3' }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt)
        .mockResolvedValueOnce(JSON.stringify(task1))
        .mockResolvedValueOnce(JSON.stringify(task2))
        .mockResolvedValueOnce(JSON.stringify(task3));

      const result = await pullRemoteChanges(config, context);

      expect(result.tasks).toHaveLength(3);
      expect(await db.tasks.count()).toBe(3);
    });
  });

  describe('incremental pull with timestamps', () => {
    it('should send lastSyncAt timestamp to API', async () => {
      const lastSync = Date.now() - 60000; // 1 minute ago
      const config = createMockSyncConfig({ lastSyncAt: lastSync });

      await pullRemoteChanges(config, context);

      expect(mockApi.pull).toHaveBeenCalledWith(
        expect.objectContaining({
          sinceTimestamp: lastSync,
        })
      );
    });

    it('should send vector clock to API', async () => {
      const config = createMockSyncConfig({
        vectorClock: { 'device-1': 5, 'device-2': 3 },
      });

      await pullRemoteChanges(config, context);

      expect(mockApi.pull).toHaveBeenCalledWith(
        expect.objectContaining({
          lastVectorClock: { 'device-1': 5, 'device-2': 3 },
        })
      );
    });

    it('should omit sinceTimestamp when lastSyncAt is null', async () => {
      const config = createMockSyncConfig({ lastSyncAt: null });

      await pullRemoteChanges(config, context);

      expect(mockApi.pull).toHaveBeenCalledWith(
        expect.objectContaining({
          sinceTimestamp: undefined,
        })
      );
    });

    it('should use limit parameter for pagination', async () => {
      const config = createMockSyncConfig();

      await pullRemoteChanges(config, context);

      expect(mockApi.pull).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      );
    });
  });

  describe('conflict detection during pull', () => {
    it('should apply remote version when remote is newer', async () => {
      const config = createMockSyncConfig();
      const now = Date.now();
      
      // Create local task (older)
      const localTask = createMockTask({
        id: 'conflict-task',
        title: 'Local Version',
        updatedAt: new Date(now - 5000).toISOString(),
      });
      await db.tasks.add(localTask);

      // Remote task (newer)
      const remoteTask = createMockTask({
        id: 'conflict-task',
        title: 'Remote Version',
        updatedAt: new Date(now).toISOString(),
      });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({
              id: 'conflict-task',
              updatedAt: now,
            }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(remoteTask));

      await pullRemoteChanges(config, context);

      const savedTask = await db.tasks.get('conflict-task');
      expect(savedTask?.title).toBe('Remote Version');
    });

    it('should keep local version when local is newer', async () => {
      const config = createMockSyncConfig();
      const now = Date.now();
      
      // Create local task (newer)
      const localTask = createMockTask({
        id: 'conflict-task',
        title: 'Local Version',
        updatedAt: new Date(now).toISOString(),
      });
      await db.tasks.add(localTask);

      // Remote task (older)
      const remoteTask = createMockTask({
        id: 'conflict-task',
        title: 'Remote Version',
        updatedAt: new Date(now - 5000).toISOString(),
      });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({
              id: 'conflict-task',
              updatedAt: now - 5000,
            }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(remoteTask));

      await pullRemoteChanges(config, context);

      const savedTask = await db.tasks.get('conflict-task');
      expect(savedTask?.title).toBe('Local Version');
    });

    it('should apply remote version when timestamps are equal', async () => {
      const config = createMockSyncConfig();
      const now = Date.now();
      const timestamp = new Date(now).toISOString();
      
      // Create local task
      const localTask = createMockTask({
        id: 'conflict-task',
        title: 'Local Version',
        updatedAt: timestamp,
      });
      await db.tasks.add(localTask);

      // Remote task with same timestamp
      const remoteTask = createMockTask({
        id: 'conflict-task',
        title: 'Remote Version',
        updatedAt: timestamp,
      });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({
              id: 'conflict-task',
              updatedAt: now,
            }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(remoteTask));

      await pullRemoteChanges(config, context);

      const savedTask = await db.tasks.get('conflict-task');
      expect(savedTask?.title).toBe('Remote Version');
    });

    it('should create new task when no local version exists', async () => {
      const config = createMockSyncConfig();
      const remoteTask = createMockTask({
        id: 'new-task',
        title: 'New Remote Task',
      });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [createMockEncryptedTaskBlob({ id: 'new-task' })],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(remoteTask));

      await pullRemoteChanges(config, context);

      const savedTask = await db.tasks.get('new-task');
      expect(savedTask).toBeDefined();
      expect(savedTask?.title).toBe('New Remote Task');
    });
  });

  describe('local database updates', () => {
    it('should update existing tasks', async () => {
      const config = createMockSyncConfig();
      const now = Date.now();
      
      // Create existing task
      await db.tasks.add(
        createMockTask({
          id: 'existing-task',
          title: 'Old Title',
          completed: false,
          updatedAt: new Date(now - 10000).toISOString(),
        })
      );

      // Remote update
      const updatedTask = createMockTask({
        id: 'existing-task',
        title: 'New Title',
        completed: true,
        updatedAt: new Date(now).toISOString(),
      });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({
              id: 'existing-task',
              updatedAt: now,
            }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(updatedTask));

      await pullRemoteChanges(config, context);

      const savedTask = await db.tasks.get('existing-task');
      expect(savedTask?.title).toBe('New Title');
      expect(savedTask?.completed).toBe(true);
    });

    it('should handle task deletions', async () => {
      const config = createMockSyncConfig();
      
      // Create tasks to be deleted
      await db.tasks.add(createMockTask({ id: 'task-1' }));
      await db.tasks.add(createMockTask({ id: 'task-2' }));
      await db.tasks.add(createMockTask({ id: 'task-3' }));

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          deletedTaskIds: ['task-1', 'task-3'],
        })
      );

      await pullRemoteChanges(config, context);

      expect(await db.tasks.get('task-1')).toBeUndefined();
      expect(await db.tasks.get('task-2')).toBeDefined();
      expect(await db.tasks.get('task-3')).toBeUndefined();
    });

    it('should handle bulk deletions', async () => {
      const config = createMockSyncConfig();
      
      // Create many tasks
      for (let i = 1; i <= 10; i++) {
        await db.tasks.add(createMockTask({ id: `task-${i}` }));
      }

      const deletedIds = ['task-1', 'task-3', 'task-5', 'task-7', 'task-9'];

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({ deletedTaskIds: deletedIds })
      );

      await pullRemoteChanges(config, context);

      expect(await db.tasks.count()).toBe(5);
      
      for (const id of deletedIds) {
        expect(await db.tasks.get(id)).toBeUndefined();
      }
    });

    it('should preserve local vector clock when merging', async () => {
      const config = createMockSyncConfig();
      
      // Create local task with vector clock
      await db.tasks.add(
        createMockTask({
          id: 'task-1',
          vectorClock: { 'device-1': 3 },
          updatedAt: new Date(Date.now() - 10000).toISOString(),
        })
      );

      const remoteTask = createMockTask({
        id: 'task-1',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({
              id: 'task-1',
              vectorClock: { 'device-2': 5 },
              updatedAt: Date.now(),
            }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt).mockResolvedValue(JSON.stringify(remoteTask));

      await pullRemoteChanges(config, context);

      const savedTask = await db.tasks.get('task-1');
      // Vector clock should be merged (contains both device clocks)
      expect(savedTask?.vectorClock).toEqual({ 'device-1': 3, 'device-2': 5 });
    });
  });

  describe('error handling', () => {
    it('should throw error when API pull fails', async () => {
      const config = createMockSyncConfig();
      const apiError = new Error('Network error');
      
      vi.mocked(mockApi.pull).mockRejectedValue(apiError);

      await expect(pullRemoteChanges(config, context)).rejects.toThrow('Network error');
    });

    it('should continue processing other tasks when one fails decryption', async () => {
      const config = createMockSyncConfig();
      const task2 = createMockTask({ id: 'task-2', title: 'Task 2' });
      const task3 = createMockTask({ id: 'task-3', title: 'Task 3' });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({ id: 'task-1' }),
            createMockEncryptedTaskBlob({ id: 'task-2' }),
            createMockEncryptedTaskBlob({ id: 'task-3' }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt)
        .mockRejectedValueOnce(new Error('Decryption failed'))
        .mockResolvedValueOnce(JSON.stringify(task2))
        .mockResolvedValueOnce(JSON.stringify(task3));

      const result = await pullRemoteChanges(config, context);

      // Should still process remaining tasks
      expect(result.tasks).toHaveLength(3);
      expect(await db.tasks.get('task-1')).toBeUndefined();
      expect(await db.tasks.get('task-2')).toBeDefined();
      expect(await db.tasks.get('task-3')).toBeDefined();
    });

    it('should continue processing when task validation fails', async () => {
      const config = createMockSyncConfig();
      const validTask = createMockTask({ id: 'valid-task' });

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({ id: 'invalid-task' }),
            createMockEncryptedTaskBlob({ id: 'valid-task' }),
          ],
        })
      );

      vi.mocked(mockCrypto.decrypt)
        .mockResolvedValueOnce('{ "invalid": "json" }') // Invalid task schema
        .mockResolvedValueOnce(JSON.stringify(validTask));

      const result = await pullRemoteChanges(config, context);

      expect(result.tasks).toHaveLength(2);
      expect(await db.tasks.get('invalid-task')).toBeUndefined();
      expect(await db.tasks.get('valid-task')).toBeDefined();
    });

    it('should handle empty pull response', async () => {
      const config = createMockSyncConfig();

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [],
          deletedTaskIds: [],
        })
      );

      const result = await pullRemoteChanges(config, context);

      expect(result.tasks).toHaveLength(0);
      expect(result.deletedTaskIds).toHaveLength(0);
    });
  });

  describe('return value', () => {
    it('should return pull result with task count', async () => {
      const config = createMockSyncConfig();

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          tasks: [
            createMockEncryptedTaskBlob({ id: 'task-1' }),
            createMockEncryptedTaskBlob({ id: 'task-2' }),
          ],
        })
      );

      const result = await pullRemoteChanges(config, context);

      expect(result.tasks).toHaveLength(2);
    });

    it('should return deleted task IDs', async () => {
      const config = createMockSyncConfig();

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          deletedTaskIds: ['task-1', 'task-2', 'task-3'],
        })
      );

      const result = await pullRemoteChanges(config, context);

      expect(result.deletedTaskIds).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should return server vector clock', async () => {
      const config = createMockSyncConfig();
      const serverClock = { 'device-1': 10, 'device-2': 5 };

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          serverVectorClock: serverClock,
        })
      );

      const result = await pullRemoteChanges(config, context);

      expect(result.serverVectorClock).toEqual(serverClock);
    });

    it('should return conflicts array', async () => {
      const config = createMockSyncConfig();

      vi.mocked(mockApi.pull).mockResolvedValue(
        createMockPullResponse({
          conflicts: [],
        })
      );

      const result = await pullRemoteChanges(config, context);

      expect(result.conflicts).toEqual([]);
    });
  });
});
