import { describe, it, expect, beforeEach } from 'vitest';
import { clearPocketBase, getPocketBase, getCurrentUserId } from '@/lib/sync/pocketbase-client';

// A JWT the SDK's LocalAuthStore treats as valid: exp far in the future.
function makeToken(exp: number): string {
  const b64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp })}.sig`;
}
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 60 * 60;

/**
 * The SDK persists auth under one shared localStorage key and `authRefresh()`
 * saves whatever the server returns, with no notion of which session asked.
 * These tests pin the teardown contract that keeps a late response for a
 * signed-out account from reappearing as the current principal.
 */
describe('clearPocketBase', () => {
  beforeEach(() => {
    clearPocketBase();
    window.localStorage.removeItem('pocketbase_auth');
  });

  it('clears the persisted session so the next client starts signed out', () => {
    getPocketBase().authStore.save(makeToken(FAR_FUTURE), { id: 'user-a' });
    expect(getCurrentUserId()).toBe('user-a');

    clearPocketBase();

    expect(getCurrentUserId()).toBeNull();
    expect(window.localStorage.getItem('pocketbase_auth')).toBeNull();
  });

  it('detaches the old client from shared storage so a late save cannot overwrite the next account', () => {
    const oldClient = getPocketBase();
    oldClient.authStore.save(makeToken(FAR_FUTURE), { id: 'user-a' });

    clearPocketBase();
    getPocketBase().authStore.save(makeToken(FAR_FUTURE), { id: 'user-b' });

    // What the SDK does when account A's in-flight authRefresh finally resolves.
    oldClient.authStore.save(makeToken(FAR_FUTURE), { id: 'user-a' });

    expect(getCurrentUserId()).toBe('user-b');
    expect(JSON.parse(window.localStorage.getItem('pocketbase_auth') ?? '{}').record?.id).toBe('user-b');
  });
});
