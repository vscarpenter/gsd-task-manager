import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalSignOutIncompleteError, signOutEverywhere } from '@/lib/sync/sign-out-everywhere';

const { sendMock, disableSyncMock, clearPocketBaseMock, authStore, order } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  disableSyncMock: vi.fn(),
  clearPocketBaseMock: vi.fn(),
  authStore: { isValid: true },
  order: [] as string[],
}));

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: () => ({ send: sendMock, authStore }),
  clearPocketBase: clearPocketBaseMock,
}));

vi.mock('@/lib/sync/config', () => ({
  disableSync: disableSyncMock,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

/** PocketBase's ClientResponseError carries the HTTP status, or 0 when offline. */
function responseError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe('signOutEverywhere', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    authStore.isValid = true;
    sendMock.mockImplementation(async () => {
      order.push('revoke');
    });
    disableSyncMock.mockImplementation(async () => {
      order.push('sign-out');
    });
  });

  it('ends every session on the server, then signs out on this device', async () => {
    await expect(signOutEverywhere()).resolves.toEqual({ otherSessionsEnded: true });

    expect(sendMock).toHaveBeenCalledWith('/api/gsd/sessions', { method: 'DELETE' });
    expect(order).toEqual(['revoke', 'sign-out']);
  });

  it('signs out on this device only when the server has no revoke route', async () => {
    // Production runs PocketBase without the repo's hooks (ADR 0016).
    sendMock.mockRejectedValue(responseError(404));

    await expect(signOutEverywhere()).resolves.toEqual({ otherSessionsEnded: false });

    expect(disableSyncMock).toHaveBeenCalledTimes(1);
  });

  it('finishes signing out when the server already rejects an unexpired token', async () => {
    // A rotation whose 204 was lost: the key already changed, so every session has ended.
    sendMock.mockRejectedValue(responseError(401));

    await expect(signOutEverywhere()).resolves.toEqual({ otherSessionsEnded: true });

    expect(disableSyncMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['offline', 0, true],
    ['an expired token', 401, false],
    ['a server error', 500, true],
  ])('stays signed in when the revoke fails with %s', async (_label, status, tokenUnexpired) => {
    authStore.isValid = tokenUnexpired;
    sendMock.mockRejectedValue(responseError(status));

    await expect(signOutEverywhere()).rejects.toMatchObject({ status });

    expect(disableSyncMock).not.toHaveBeenCalled();
  });

  it.each([
    ['after ending every session', undefined, true],
    ['after the route was missing', responseError(404), false],
  ])('never keeps the token when this device fails to sign out %s', async (_label, sendError, ended) => {
    if (sendError) sendMock.mockRejectedValue(sendError);
    disableSyncMock.mockRejectedValue(new Error('IndexedDB quota exceeded'));

    const failure = await signOutEverywhere().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LocalSignOutIncompleteError);
    expect(failure).toMatchObject({ otherSessionsEnded: ended });
    expect(clearPocketBaseMock).toHaveBeenCalledTimes(1);
  });
});
