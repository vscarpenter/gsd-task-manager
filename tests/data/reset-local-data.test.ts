/**
 * Verified local wipe (AC3, AC4, AC7, and the device ID half of AC19).
 *
 * Runs the real resetEverything against fake-indexeddb, so Dexie's clear,
 * count, delete, and reopen behave as they do in a browser. Only the network
 * edge, health monitor, and browser caches are mocked.
 * tests/data/reset-everything.test.ts mocks the database, so it cannot host these checks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Dexie, { type Table } from 'dexie';
import { getDb } from '@/lib/db';
import { createMockSyncConfig, createMockTask } from '@/tests/fixtures';
import type { PBSyncConfig } from '@/lib/sync/types';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: () => null,
  isAuthenticated: () => false,
  clearPocketBase: vi.fn(),
}));

vi.mock('@/lib/sync/health-monitor', () => ({
  getHealthMonitor: () => ({ isActive: () => false, stop: vi.fn() }),
}));

vi.mock('@/lib/browser-cache', () => ({
  clearAppCaches: vi.fn().mockResolvedValue([]),
}));

import { resetEverything } from '@/lib/reset-everything';

const DATABASE_NAME = 'GsdTaskManager';
const RESET_PENDING_KEY = 'gsd-reset-pending';

type AnyTable = Table<unknown, string>;
// Every Dexie table shares this prototype, so one spy reaches the clear inside reset's transaction.
const tablePrototype = Object.getPrototypeOf(getDb().tasks) as AnyTable;
const originalClear = tablePrototype.clear;

/** Make the tasks table's clear throw, or resolve while leaving its rows in place. */
function breakTasksClear(mode: 'throw' | 'leave-rows'): void {
  vi.spyOn(tablePrototype, 'clear').mockImplementation(function (this: AnyTable) {
    if (this.name !== 'tasks') return originalClear.call(this);
    const outcome = mode === 'throw'
      ? Dexie.Promise.reject(new Error('tasks clear failed'))
      : Dexie.Promise.resolve();
    return outcome as ReturnType<AnyTable['clear']>;
  });
}

/** Open a raw connection that ignores versionchange, like a tab that never lets go. */
function openBlockingConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('verified local wipe', () => {
  beforeEach(async () => {
    localStorage.removeItem(RESET_PENDING_KEY);
    const db = getDb();
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.tasks.add(createMockTask({ id: 'task-private', title: 'Private task title' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should_delete_the_database_when_the_table_clear_throws', async () => {
    breakTasksClear('throw');

    const result = await resetEverything();

    expect(result.failedSteps).not.toContain('local-data');
    expect(localStorage.getItem(RESET_PENDING_KEY)).toBeNull();
    await expect(Dexie.exists(DATABASE_NAME)).resolves.toBe(false);
  });

  it('should_delete_the_database_when_rows_survive_the_clear', async () => {
    breakTasksClear('leave-rows');

    const result = await resetEverything();

    expect(result.failedSteps).not.toContain('local-data');
    await expect(Dexie.exists(DATABASE_NAME)).resolves.toBe(false);
  });

  it('should_open_an_empty_database_after_the_fallback_delete', async () => {
    breakTasksClear('throw');
    await resetEverything();
    vi.restoreAllMocks();

    await expect(getDb().tasks.toArray()).resolves.toEqual([]);
  });

  it('should_preserve_the_device_id_when_the_normal_wipe_succeeds', async () => {
    await getDb().syncMetadata.put(createMockSyncConfig({ deviceId: 'device-kept', userId: 'user-1' }));

    const result = await resetEverything();

    const config = (await getDb().syncMetadata.get('sync_config')) as PBSyncConfig | undefined;
    expect(result.failedSteps).not.toContain('local-data');
    expect(config).toMatchObject({ deviceId: 'device-kept', userId: null, enabled: false });
  });

  it('should_fail_the_local_data_step_when_another_connection_blocks_the_delete', async () => {
    const blocker = await openBlockingConnection();
    breakTasksClear('throw');

    try {
      const result = await resetEverything();

      expect(result.failedSteps).toContain('local-data');
    } finally {
      blocker.close();
    }
  });
});
