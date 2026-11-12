import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import type { PBSyncConfig } from '@/lib/sync/types';
import { createMockSyncConfig, createMockTask } from '@/tests/fixtures';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  clearPocketBase: vi.fn(),
  getPocketBase: vi.fn(),
}));

vi.mock('@/lib/browser-cache', () => ({
  clearAppCaches: vi.fn().mockResolvedValue([]),
}));

import { disableSync, updateAutoSyncConfig } from '@/lib/sync/config';
import { getSyncQueue } from '@/lib/sync/queue';
import { persistSyncConfig } from '@/components/sync/use-sync-auth-dialog';

const AUTH_A = { isLoggedIn: true, userId: 'user-a', email: 'a@example.com', provider: 'google' };

function signedIn(userId: string): PBSyncConfig {
  return createMockSyncConfig({ userId, localTaskOwnerUserId: userId });
}

/** The row a dialog still shows after an earlier sign-out: sync off, no owner recorded. */
function signedOutNoOwner(): PBSyncConfig {
  return createMockSyncConfig({ enabled: false, userId: null, localTaskOwnerUserId: null });
}

async function storedConfig(): Promise<PBSyncConfig | undefined> {
  return (await getDb().syncMetadata.get('sync_config')) as PBSyncConfig | undefined;
}

/** The account the local rows belong to, as sign-in reads it. */
function localOwner(config: PBSyncConfig | undefined): string | null {
  return config?.localTaskOwnerUserId ?? config?.userId ?? null;
}

describe('sync_config writes read the row they replace', () => {
  beforeEach(async () => {
    const db = getDb();
    await Promise.all([
      db.syncMetadata.clear(),
      db.syncQueue.clear(),
      db.syncHistory.clear(),
      db.tasks.clear(),
      db.archivedTasks.clear(),
      db.deletedTasks.clear(),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('disableSync', () => {
    it('should_keep_the_local_task_owner_when_a_sign_in_saves_while_sign_out_starts', async () => {
      const db = getDb();
      await db.syncMetadata.put(signedOutNoOwner());
      await db.tasks.put(createMockTask({ id: 'a-task' }));

      // Sign out is clicked in a dialog that shows the older session. Account A's
      // sign-in saves in the same moment.
      const signOut = disableSync();
      const signIn = db.syncMetadata.put(signedIn('user-a'));
      await Promise.all([signOut, signIn]);

      // A's task is still on the device, so the row must still say whose it is.
      // Otherwise the next account to sign in uploads it as its own.
      expect(localOwner(await storedConfig())).toBe('user-a');
    });

    it('should_write_the_signed_out_row_for_the_account_that_is_signed_in', async () => {
      await getDb().syncMetadata.put(signedIn('user-a'));

      await disableSync();

      const config = await storedConfig();
      expect(config?.enabled).toBe(false);
      expect(config?.userId).toBeNull();
      expect(config?.localTaskOwnerUserId).toBe('user-a');
    });

    it('should_write_nothing_when_no_sync_config_exists', async () => {
      await disableSync();

      expect(await storedConfig()).toBeUndefined();
    });
  });

  describe('updateAutoSyncConfig', () => {
    it('should_not_write_an_older_account_back_over_a_sign_in_that_saved_meanwhile', async () => {
      const db = getDb();
      await db.syncMetadata.put(signedIn('user-a'));

      // Settings still shows A's session. Account B's sign-in saves in the same moment.
      const settings = updateAutoSyncConfig(false, 5);
      const signIn = db.syncMetadata.put(signedIn('user-b'));
      await Promise.all([settings, signIn]);

      expect((await storedConfig())?.userId).toBe('user-b');
    });

    it('should_merge_the_setting_into_the_current_row', async () => {
      await getDb().syncMetadata.put(signedIn('user-a'));

      await updateAutoSyncConfig(false, 5);

      const config = await storedConfig();
      expect(config?.userId).toBe('user-a');
      expect(config?.autoSyncEnabled).toBe(false);
      expect(config?.autoSyncIntervalMinutes).toBe(5);
    });
  });

  describe('persistSyncConfig', () => {
    it('should_queue_the_local_tasks_and_save_the_config', async () => {
      await getDb().tasks.put(createMockTask({ id: 'a-task' }));

      await persistSyncConfig(AUTH_A);

      expect((await storedConfig())?.userId).toBe('user-a');
      const rows = await getDb().syncQueue.toArray();
      expect(rows.map((row) => row.taskId)).toEqual(['a-task']);
    });

    it('should_save_no_config_when_queuing_the_local_tasks_fails', async () => {
      await getDb().tasks.put(createMockTask({ id: 'a-task' }));
      vi.spyOn(getSyncQueue(), 'enqueue').mockRejectedValue(new Error('QuotaExceededError'));

      await expect(persistSyncConfig(AUTH_A)).rejects.toThrow('QuotaExceededError');

      // The config and the queue rows commit together or not at all. A saved
      // config with unqueued tasks is the state a later step could race with.
      expect(await storedConfig()).toBeUndefined();
      expect(await getDb().syncQueue.count()).toBe(0);
    });

    it('should_leave_no_queue_rows_when_the_owner_check_refuses_the_sign_in', async () => {
      const db = getDb();
      await db.syncMetadata.put(
        createMockSyncConfig({ enabled: false, userId: null, localTaskOwnerUserId: 'user-b' }),
      );
      await db.tasks.put(createMockTask({ id: 'b-task' }));

      await expect(persistSyncConfig(AUTH_A)).rejects.toThrow('different sync account');

      expect(await db.syncQueue.count()).toBe(0);
    });
  });
});
