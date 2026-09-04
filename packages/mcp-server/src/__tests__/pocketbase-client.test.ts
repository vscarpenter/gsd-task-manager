import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authStore, authRefresh, autoCancellation, collection, pocketBaseConstructor } = vi.hoisted(() => {
  const store = {
    isValid: false,
    isSuperuser: false,
    token: '',
    record: null as { id?: string; collectionName?: string } | null,
    save: vi.fn(),
    clear: vi.fn(),
  };
  const refresh = vi.fn();
  const collectionMock = vi.fn(() => ({ authRefresh: refresh }));
  return {
    authStore: store,
    authRefresh: refresh,
    autoCancellation: vi.fn(),
    collection: collectionMock,
    pocketBaseConstructor: vi.fn(function PocketBaseMock() {
      return { authStore: store, autoCancellation: vi.fn(), collection: collectionMock, afterSend: undefined };
    }),
  };
});

vi.mock('pocketbase', () => ({
  default: pocketBaseConstructor,
}));

import {
  clearPocketBase,
  getCurrentUserId,
  getPocketBase,
  requireUsersPrincipal,
} from '../pocketbase-client.js';

const config = { pocketBaseUrl: 'https://pb.example.com', authToken: 'token' };

beforeEach(() => {
  clearPocketBase();
  vi.clearAllMocks();
  authStore.isValid = false;
  authStore.isSuperuser = false;
  authStore.token = '';
  authStore.record = null;
  authStore.save.mockImplementation((token: string, record: typeof authStore.record) => {
    authStore.token = token;
    authStore.record = record;
  });
  authStore.clear.mockImplementation(() => {
    authStore.token = '';
    authStore.record = null;
  });
  pocketBaseConstructor.mockImplementation(function PocketBaseMock() {
    return { authStore, autoCancellation, collection, afterSend: undefined };
  });
});

describe('getPocketBase', () => {
  it('creates one client, disables auto-cancellation, and saves an initial token', () => {
    const first = getPocketBase(config);
    const second = getPocketBase(config);

    expect(first).toBe(second);
    expect(pocketBaseConstructor).toHaveBeenCalledOnce();
    expect(pocketBaseConstructor).toHaveBeenCalledWith(config.pocketBaseUrl);
    expect(autoCancellation).toHaveBeenCalledWith(false);
    expect(authStore.save).toHaveBeenCalledWith('token', null);
  });

  it('does not resave an unchanged token and clears an empty token', () => {
    authStore.isValid = true;
    getPocketBase(config);
    getPocketBase(config);
    expect(authStore.save).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    authStore.isValid = false;
    getPocketBase({ ...config, authToken: '' });
    expect(authStore.save).not.toHaveBeenCalled();
    expect(authStore.clear).toHaveBeenCalledOnce();
  });

  it('replaces auth state when a long-lived process switches principals', () => {
    getPocketBase(config);
    getPocketBase({ ...config, authToken: 'token-two' });

    expect(authStore.clear).toHaveBeenCalledOnce();
    expect(authStore.save).toHaveBeenNthCalledWith(1, 'token', null);
    expect(authStore.save).toHaveBeenNthCalledWith(2, 'token-two', null);
  });

  it('creates a new client when the backend URL changes', () => {
    const first = getPocketBase(config);
    const second = getPocketBase({ ...config, pocketBaseUrl: 'https://other.example.com' });

    expect(second).not.toBe(first);
    expect(pocketBaseConstructor).toHaveBeenCalledTimes(2);
  });

  it('captures Retry-After from a real 429 response into the SDK error body', () => {
    const pb = getPocketBase(config) as ReturnType<typeof getPocketBase> & {
      afterSend: (response: Response, data: unknown) => unknown;
    };
    const response = new Response('{}', {
      status: 429,
      headers: { 'Retry-After': '3' },
    });

    expect(pb.afterSend(response, { message: 'rate limited' })).toEqual({
      message: 'rate limited',
      retryAfterMs: 3000,
    });
  });
});

describe('clearPocketBase', () => {
  it('clears an existing auth store and permits a new instance', () => {
    const first = getPocketBase(config);
    clearPocketBase();
    const second = getPocketBase(config);

    expect(authStore.clear).toHaveBeenCalledOnce();
    expect(second).not.toBe(first);
  });
});

describe('requireUsersPrincipal', () => {
  it('hydrates and returns a normal users-collection identity', async () => {
    authRefresh.mockImplementationOnce(async () => {
      authStore.record = { id: 'user-1', collectionName: 'users' };
    });

    await expect(requireUsersPrincipal(config)).resolves.toMatchObject({ ownerId: 'user-1' });
    expect(collection).toHaveBeenCalledWith('users');
    expect(authRefresh).toHaveBeenCalledOnce();
  });

  it('rejects a decoded superuser before any refresh request', async () => {
    authStore.isSuperuser = true;

    await expect(requireUsersPrincipal(config)).rejects.toThrow('superuser tokens are not accepted');
    expect(collection).not.toHaveBeenCalled();
    expect(authRefresh).not.toHaveBeenCalled();
    expect(authStore.clear).toHaveBeenCalled();
  });

  it('rejects a non-users auth record', async () => {
    getPocketBase(config);
    authStore.record = { id: 'admin-1', collectionName: '_superusers' };

    await expect(requireUsersPrincipal(config)).rejects.toThrow('normal users-collection account');
    expect(authRefresh).not.toHaveBeenCalled();
    expect(authStore.clear).toHaveBeenCalled();
  });

  it('rejects a token that cannot be refreshed', async () => {
    authRefresh.mockRejectedValueOnce(new Error('401'));

    await expect(requireUsersPrincipal(config)).rejects.toThrow('normal users-collection account');
    expect(authStore.clear).toHaveBeenCalled();
  });
});

describe('getCurrentUserId', () => {
  it('returns the authenticated record id', () => {
    getPocketBase(config);
    authStore.record = { id: 'user-1', collectionName: 'users' };
    expect(getCurrentUserId(config)).toBe('user-1');
  });

  it('throws when the auth record has no id', () => {
    getPocketBase(config);
    authStore.record = { collectionName: 'users' };
    expect(() => getCurrentUserId(config)).toThrow('Not authenticated');
  });

  it('throws for a record outside the users collection', () => {
    getPocketBase(config);
    authStore.record = { id: 'admin-1', collectionName: '_superusers' };
    expect(() => getCurrentUserId(config)).toThrow('normal users-collection account');
  });
});
