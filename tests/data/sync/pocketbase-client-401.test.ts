/**
 * What the real PocketBase SDK does when the server answers 401, with only
 * `fetch` stubbed. The other sync tests swap the SDK or its wrapper for a fake,
 * and a fake can't show a change in what the SDK does by itself.
 *
 * SDK 0.29.0 clears the auth store on any 401 unless told not to, and it never
 * asks which token was refused. The store is one localStorage key that every
 * tab shares, so the app decides for itself what a 401 means. `getPocketBase`
 * turns the SDK's cleanup off, and these tests fail if it comes back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshAuthOutcome } from '@/lib/sync/pb-auth';
import { clearPocketBase, getPocketBase } from '@/lib/sync/pocketbase-client';
import { signOutEverywhere } from '@/lib/sync/sign-out-everywhere';
import { sessionToken } from './support/fake-pocketbase';

const { disableSyncMock } = vi.hoisted(() => ({ disableSyncMock: vi.fn() }));

vi.mock('@/lib/sync/config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  disableSync: disableSyncMock,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const AUTH_KEY = 'pocketbase_auth';
const DAYS_LEFT = 30;
const userA = { id: 'user-a', collectionId: '_pb_users_auth_', collectionName: 'users' };

const storedToken = (): string | undefined =>
  JSON.parse(window.localStorage.getItem(AUTH_KEY) ?? 'null')?.token;

/** PocketBase's answer to a token it refuses. */
const refusal = (): Response =>
  new Response(
    JSON.stringify({ status: 401, message: 'The request requires valid record authorization token.', data: {} }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );

describe('a request the server answers with 401', () => {
  beforeEach(() => {
    clearPocketBase();
    window.localStorage.removeItem(AUTH_KEY);
    disableSyncMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a sign-in another tab saved while the refresh was in flight', async () => {
    getPocketBase().authStore.save(sessionToken(DAYS_LEFT), userA);
    const newer = sessionToken(DAYS_LEFT, userA.id, 'other-tab');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        // The other tab's sign-in lands after the request leaves and before the refusal returns.
        window.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: newer, record: userA }));
        return refusal();
      })
    );

    await expect(refreshAuthOutcome()).resolves.toBe('rejected');

    expect(storedToken()).toBe(newer);
  });

  it('finishes signing out everywhere when the refused token has not expired', async () => {
    // A revoke whose answer was lost already rotated the key, so the retry gets a 401.
    getPocketBase().authStore.save(sessionToken(DAYS_LEFT), userA);
    vi.stubGlobal('fetch', vi.fn(async () => refusal()));

    await expect(signOutEverywhere()).resolves.toEqual({ otherSessionsEnded: true });

    expect(disableSyncMock).toHaveBeenCalledTimes(1);
  });
});
