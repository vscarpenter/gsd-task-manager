import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authStore, autoCancellation, pocketBaseConstructor } = vi.hoisted(() => {
  const store = {
    isValid: false,
    record: null as { id?: string } | null,
    save: vi.fn(),
    clear: vi.fn(),
  };
  return {
    authStore: store,
    autoCancellation: vi.fn(),
    pocketBaseConstructor: vi.fn(function PocketBaseMock() {
      return { authStore: store, autoCancellation: vi.fn(), afterSend: undefined };
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
} from '../pocketbase-client.js';

const config = { pocketBaseUrl: 'https://pb.example.com', authToken: 'token' };

beforeEach(() => {
  clearPocketBase();
  vi.clearAllMocks();
  authStore.isValid = false;
  authStore.record = null;
  pocketBaseConstructor.mockImplementation(function PocketBaseMock() {
    return { authStore, autoCancellation, afterSend: undefined };
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

describe('getCurrentUserId', () => {
  it('returns the authenticated record id', () => {
    authStore.record = { id: 'user-1' };
    expect(getCurrentUserId(config)).toBe('user-1');
  });

  it('throws when the auth record has no id', () => {
    authStore.record = {};
    expect(() => getCurrentUserId(config)).toThrow('Not authenticated');
  });
});
