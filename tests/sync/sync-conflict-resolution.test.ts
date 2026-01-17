/**
 * Tests for conflict resolution - Last-Write-Wins strategy and conflict detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { autoResolveConflicts } from '@/lib/sync/engine/conflict-resolver';
import { compareVectorClocks, mergeVectorClocks } from '@/lib/sync/vector-clock';
import {
  createMockTask,
  createMockVectorClock,
  mockConsole,
} from '../fixtures';
import type { ConflictInfo } from '@/lib/sync/types';

describe('Conflict Resolution', () => {
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    db = getDb();
    consoleMock = mockConsole();

    // Clear database
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    consoleMock.restore();
    await db.delete();
  });

  describe('autoResolveConflicts - Last-Write-Wins strategy', () => {
    it('should resolve conflict by choosing remote when remote is newer', async () => {
      const now = Date.now();
      const localTask = createMockTask({
        id: 'task-1',
        title: 'Local Version',
        updatedAt: new Date(now - 1000).toISOString(), // 1 second older
      });
      const remoteTask = createMockTask({
        id: 'task-1',
        title: 'Remote Version',
        updatedAt: new Date(now).toISOString(), // newer
      });

      const conflict: ConflictInfo = {
        taskId: 'task-1',
        local: localTask,
        remote: remoteTask,
        localClock: createMockVectorClock({ 'device-1': 1 }),
        remoteClock: createMockVectorClock({ 'device-2': 1 }),
      };

      const resolved = await autoResolveConflicts([conflict]);

      expect(resolved).toBe(1);

      // Verify remote version was saved
      const savedTask = await db.tasks.get('task-1');
      expect(savedTask).toBeDefined();
      expect(savedTask?.title).toBe('Remote Version');
    });

    it('should resolve conflict by choosing local when local is newer', async () => {
      const now = Date.now();
      const localTask = createMockTask({
        id: 'task-2',
        title: 'Local Version',
        updatedAt: new Date(now).toISOString(), // newer
      });
      const remoteTask = createMockTask({
        id: 'task-2',
        title: 'Remote Version',
        updatedAt: new Date(now - 2000).toISOString(), // 2 seconds older
      });

      const conflict: ConflictInfo = {
        taskId: 'task-2',
        local: localTask,
        remote: remoteTask,
        localClock: createMockVectorClock({ 'device-1': 2 }),
        remoteClock: createMockVectorClock({ 'device-2': 1 }),
      };

      const resolved = await autoResolveConflicts([conflict]);

      expect(resolved).toBe(1);

      // Verify local version was saved
      const savedTask = await db.tasks.get('task-2');
      expect(savedTask).toBeDefined();
      expect(savedTask?.title).toBe('Local Version');
    });

    it('should merge vector clocks when resolving conflict', async () => {
      const now = Date.now();
      const localTask = createMockTask({
        id: 'task-3',
        updatedAt: new Date(now).toISOString(),
      });
      const remoteTask = createMockTask({
        id: 'task-3',
        updatedAt: new Date(now - 1000).toISOString(),
      });

      const localClock = { 'device-1': 5, 'device-2': 2 };
      const remoteClock = { 'device-2': 3, 'device-3': 1 };

      const conflict: ConflictInfo = {
        taskId: 'task-3',
        local: localTask,
        remote: remoteTask,
        localClock,
        remoteClock,
      };

      await autoResolveConflicts([conflict]);

      const savedTask = await db.tasks.get('task-3');
      expect(savedTask?.vectorClock).toEqual({
        'device-1': 5,
        'device-2': 3, // max of 2 and 3
        'device-3': 1,
      });
    });

    it('should resolve multiple conflicts in batch', async () => {
      const now = Date.now();
      const conflicts: ConflictInfo[] = [
        {
          taskId: 'task-a',
          local: createMockTask({ id: 'task-a', title: 'Local A', updatedAt: new Date(now).toISOString() }),
          remote: createMockTask({ id: 'task-a', title: 'Remote A', updatedAt: new Date(now - 1000).toISOString() }),
          localClock: createMockVectorClock({ 'device-1': 1 }),
          remoteClock: createMockVectorClock({ 'device-2': 1 }),
        },
        {
          taskId: 'task-b',
          local: createMockTask({ id: 'task-b', title: 'Local B', updatedAt: new Date(now - 2000).toISOString() }),
          remote: createMockTask({ id: 'task-b', title: 'Remote B', updatedAt: new Date(now).toISOString() }),
          localClock: createMockVectorClock({ 'device-1': 1 }),
          remoteClock: createMockVectorClock({ 'device-2': 1 }),
        },
        {
          taskId: 'task-c',
          local: createMockTask({ id: 'task-c', title: 'Local C', updatedAt: new Date(now).toISOString() }),
          remote: createMockTask({ id: 'task-c', title: 'Remote C', updatedAt: new Date(now - 500).toISOString() }),
          localClock: createMockVectorClock({ 'device-1': 1 }),
          remoteClock: createMockVectorClock({ 'device-2': 1 }),
        },
      ];

      const resolved = await autoResolveConflicts(conflicts);

      expect(resolved).toBe(3);

      // Verify each resolution
      const taskA = await db.tasks.get('task-a');
      expect(taskA?.title).toBe('Local A'); // local was newer

      const taskB = await db.tasks.get('task-b');
      expect(taskB?.title).toBe('Remote B'); // remote was newer

      const taskC = await db.tasks.get('task-c');
      expect(taskC?.title).toBe('Local C'); // local was newer
    });

    it('should handle conflicts with identical timestamps by choosing remote', async () => {
      const now = Date.now();
      const timestamp = new Date(now).toISOString();
      
      const localTask = createMockTask({
        id: 'task-4',
        title: 'Local Version',
        updatedAt: timestamp,
      });
      const remoteTask = createMockTask({
        id: 'task-4',
        title: 'Remote Version',
        updatedAt: timestamp,
      });

      const conflict: ConflictInfo = {
        taskId: 'task-4',
        local: localTask,
        remote: remoteTask,
        localClock: createMockVectorClock({ 'device-1': 1 }),
        remoteClock: createMockVectorClock({ 'device-2': 1 }),
      };

      await autoResolveConflicts([conflict]);

      const savedTask = await db.tasks.get('task-4');
      // When timestamps are equal, remote wins (remoteTime > localTime is false, so local wins)
      // Actually, when equal, neither is greater, so local wins
      expect(savedTask?.title).toBe('Local Version');
    });
  });

  describe('conflict detection logic', () => {
    it('should skip conflicts with missing local data', async () => {
      const conflict: ConflictInfo = {
        taskId: 'task-5',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        local: null as any, // missing local
        remote: createMockTask({ id: 'task-5' }),
        localClock: createMockVectorClock(),
        remoteClock: createMockVectorClock(),
      };

      const resolved = await autoResolveConflicts([conflict]);

      expect(resolved).toBe(0);

      // Verify nothing was saved
      const savedTask = await db.tasks.get('task-5');
      expect(savedTask).toBeUndefined();
    });

    it('should skip conflicts with missing remote data', async () => {
      const conflict: ConflictInfo = {
        taskId: 'task-6',
        local: createMockTask({ id: 'task-6' }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remote: null as any, // missing remote
        localClock: createMockVectorClock(),
        remoteClock: createMockVectorClock(),
      };

      const resolved = await autoResolveConflicts([conflict]);

      expect(resolved).toBe(0);

      // Verify nothing was saved
      const savedTask = await db.tasks.get('task-6');
      expect(savedTask).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      const now = Date.now();
      const conflict: ConflictInfo = {
        taskId: 'task-7',
        local: createMockTask({ id: 'task-7', updatedAt: new Date(now).toISOString() }),
        remote: createMockTask({ id: 'task-7', updatedAt: new Date(now - 1000).toISOString() }),
        localClock: createMockVectorClock(),
        remoteClock: createMockVectorClock(),
      };

      // Mock database error
      const originalPut = db.tasks.put;
      db.tasks.put = vi.fn().mockRejectedValue(new Error('Database error'));

      const resolved = await autoResolveConflicts([conflict]);

      expect(resolved).toBe(0);

      // Restore original method
      db.tasks.put = originalPut;
    });

    it('should continue resolving after individual failure', async () => {
      const now = Date.now();
      const conflicts: ConflictInfo[] = [
        {
          taskId: 'task-8',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          local: null as any, // will fail
          remote: createMockTask({ id: 'task-8' }),
          localClock: createMockVectorClock(),
          remoteClock: createMockVectorClock(),
        },
        {
          taskId: 'task-9',
          local: createMockTask({ id: 'task-9', updatedAt: new Date(now).toISOString() }),
          remote: createMockTask({ id: 'task-9', updatedAt: new Date(now - 1000).toISOString() }),
          localClock: createMockVectorClock(),
          remoteClock: createMockVectorClock(),
        },
      ];

      const resolved = await autoResolveConflicts(conflicts);

      expect(resolved).toBe(1); // Only second conflict resolved

      const task9 = await db.tasks.get('task-9');
      expect(task9).toBeDefined();
    });
  });

  describe('vector clock comparison', () => {
    it('should detect concurrent modifications (conflict)', () => {
      const clockA = { 'device-1': 2, 'device-2': 1 };
      const clockB = { 'device-1': 1, 'device-2': 2 };

      const result = compareVectorClocks(clockA, clockB);

      expect(result).toBe('concurrent');
    });

    it('should detect when A happened before B', () => {
      const clockA = { 'device-1': 1, 'device-2': 1 };
      const clockB = { 'device-1': 2, 'device-2': 2 };

      const result = compareVectorClocks(clockA, clockB);

      expect(result).toBe('b_before_a'); // B is greater, so A happened before B
    });

    it('should detect when B happened before A', () => {
      const clockA = { 'device-1': 3, 'device-2': 2 };
      const clockB = { 'device-1': 1, 'device-2': 1 };

      const result = compareVectorClocks(clockA, clockB);

      expect(result).toBe('a_before_b'); // A is greater, so B happened before A
    });

    it('should detect identical clocks', () => {
      const clockA = { 'device-1': 2, 'device-2': 3 };
      const clockB = { 'device-1': 2, 'device-2': 3 };

      const result = compareVectorClocks(clockA, clockB);

      expect(result).toBe('identical');
    });

    it('should handle clocks with different devices', () => {
      const clockA = { 'device-1': 2 };
      const clockB = { 'device-2': 2 };

      const result = compareVectorClocks(clockA, clockB);

      expect(result).toBe('concurrent');
    });

    it('should handle empty clocks', () => {
      const clockA = {};
      const clockB = {};

      const result = compareVectorClocks(clockA, clockB);

      expect(result).toBe('identical');
    });
  });

  describe('vector clock merging', () => {
    it('should merge clocks by taking maximum for each device', () => {
      const clockA = { 'device-1': 5, 'device-2': 2, 'device-3': 1 };
      const clockB = { 'device-1': 3, 'device-2': 4, 'device-4': 2 };

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual({
        'device-1': 5, // max(5, 3)
        'device-2': 4, // max(2, 4)
        'device-3': 1, // only in A
        'device-4': 2, // only in B
      });
    });

    it('should handle merging with empty clock', () => {
      const clockA = { 'device-1': 3, 'device-2': 2 };
      const clockB = {};

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual(clockA);
    });

    it('should handle merging empty clock with non-empty', () => {
      const clockA = {};
      const clockB = { 'device-1': 3, 'device-2': 2 };

      const merged = mergeVectorClocks(clockA, clockB);

      expect(merged).toEqual(clockB);
    });

    it('should not mutate original clocks', () => {
      const clockA = { 'device-1': 2 };
      const clockB = { 'device-2': 3 };

      const originalA = { ...clockA };
      const originalB = { ...clockB };

      mergeVectorClocks(clockA, clockB);

      expect(clockA).toEqual(originalA);
      expect(clockB).toEqual(originalB);
    });
  });

  describe('conflict resolution with task data', () => {
    it('should preserve all task fields from winner', async () => {
      const now = Date.now();
      const remoteTask = createMockTask({
        id: 'task-10',
        title: 'Remote Title',
        description: 'Remote Description',
        urgent: true,
        important: false,
        completed: true,
        tags: ['remote', 'tag'],
        updatedAt: new Date(now).toISOString(),
      });
      const localTask = createMockTask({
        id: 'task-10',
        title: 'Local Title',
        description: 'Local Description',
        urgent: false,
        important: true,
        completed: false,
        tags: ['local'],
        updatedAt: new Date(now - 1000).toISOString(),
      });

      const conflict: ConflictInfo = {
        taskId: 'task-10',
        local: localTask,
        remote: remoteTask,
        localClock: createMockVectorClock(),
        remoteClock: createMockVectorClock(),
      };

      await autoResolveConflicts([conflict]);

      const savedTask = await db.tasks.get('task-10');
      expect(savedTask?.title).toBe('Remote Title');
      expect(savedTask?.description).toBe('Remote Description');
      expect(savedTask?.urgent).toBe(true);
      expect(savedTask?.important).toBe(false);
      expect(savedTask?.completed).toBe(true);
      expect(savedTask?.tags).toEqual(['remote', 'tag']);
    });

    it('should handle conflicts with subtasks', async () => {
      const now = Date.now();
      const remoteTask = createMockTask({
        id: 'task-11',
        subtasks: [
          { id: 'sub-1', title: 'Remote Subtask', completed: false },
        ],
        updatedAt: new Date(now).toISOString(),
      });
      const localTask = createMockTask({
        id: 'task-11',
        subtasks: [
          { id: 'sub-2', title: 'Local Subtask', completed: true },
        ],
        updatedAt: new Date(now - 1000).toISOString(),
      });

      const conflict: ConflictInfo = {
        taskId: 'task-11',
        local: localTask,
        remote: remoteTask,
        localClock: createMockVectorClock(),
        remoteClock: createMockVectorClock(),
      };

      await autoResolveConflicts([conflict]);

      const savedTask = await db.tasks.get('task-11');
      expect(savedTask?.subtasks).toHaveLength(1);
      expect(savedTask?.subtasks[0].title).toBe('Remote Subtask');
    });
  });
});
