import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import {
  StaleSyncSessionError,
  assertSyncSessionCurrent,
  getSessionOwner,
} from '@/lib/sync/sync-session';
import type { PBSyncConfig } from '@/lib/sync/types';

function syncConfig(overrides: Partial<PBSyncConfig> = {}): PBSyncConfig {
  return {
    key: 'sync_config',
    enabled: true,
    userId: 'user-1',
    deviceId: 'device-1',
    deviceName: 'Test device',
    email: 'one@example.com',
    provider: 'google',
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
    ...overrides,
  };
}

/** The check only means something inside a transaction that scopes syncMetadata. */
async function checkInsideTransaction(ownerId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.syncMetadata], () => assertSyncSessionCurrent(ownerId));
}

describe('sync session fence', () => {
  beforeEach(async () => {
    await getDb().syncMetadata.clear();
  });

  it('should_return_null_owner_when_config_missing_disabled_or_without_user_id', () => {
    expect(getSessionOwner(undefined)).toBeNull();
    expect(getSessionOwner(syncConfig({ enabled: false }))).toBeNull();
    expect(getSessionOwner(syncConfig({ userId: null }))).toBeNull();
  });

  it('should_return_user_id_as_owner_when_sync_is_enabled', () => {
    expect(getSessionOwner(syncConfig())).toBe('user-1');
  });

  it('should_throw_stale_session_when_config_disabled', async () => {
    await getDb().syncMetadata.put(syncConfig({ enabled: false }));

    await expect(checkInsideTransaction('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);
  });

  it('should_throw_stale_session_when_config_missing', async () => {
    await expect(checkInsideTransaction('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);
  });

  it('should_throw_stale_session_when_user_id_differs', async () => {
    await getDb().syncMetadata.put(syncConfig({ userId: 'user-2' }));

    await expect(checkInsideTransaction('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);
  });

  it('should_pass_when_enabled_config_matches_owner', async () => {
    await getDb().syncMetadata.put(syncConfig());

    await expect(checkInsideTransaction('user-1')).resolves.toBeUndefined();
  });
});
