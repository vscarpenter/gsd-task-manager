/**
 * What the real PocketBase SDK does when the server answers 401, with only
 * `fetch` stubbed. The other client tests replace the SDK with a fake, and a
 * fake can't show a change in what the SDK does by itself.
 *
 * SDK 0.29.0 clears the auth store on any 401 unless told not to. This client
 * remembers the token it saved (`pbToken`) and saves again only when the
 * configured token changes. A store the SDK emptied is never refilled, so the
 * next request goes out as a guest. `getPocketBase` turns the SDK's cleanup
 * off, so the store changes only where this client also updates `pbToken`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPocketBase, getPocketBase } from '../pocketbase-client.js';

const HOUR_SECONDS = 60 * 60;

/** A users-collection token the SDK can decode. Nothing here checks the signature. */
function userToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + HOUR_SECONDS;
  const payload = { type: 'auth', collectionId: '_pb_users_auth_', exp };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const config = { pocketBaseUrl: 'https://pb.example.com', authToken: userToken() };

const answer = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('a request the server answers with 401', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearPocketBase();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('presents the configured token again on the next request', async () => {
    fetchMock
      .mockResolvedValueOnce(
        answer(401, { status: 401, message: 'The request requires valid record authorization token.', data: {} })
      )
      .mockResolvedValueOnce(answer(200, { page: 1, perPage: 1, totalItems: 0, totalPages: 0, items: [] }));
    // The conditional write route requires auth, so it is where a 401 arrives.
    const write = getPocketBase(config).send('/api/gsd/tasks/rec_1', {
      method: 'DELETE',
      body: { expected_version: '2026-11-17T00:00:00.000Z' },
    });
    await expect(write).rejects.toMatchObject({ status: 401 });

    await getPocketBase(config).collection('tasks').getList(1, 1);

    const [, nextRequest] = fetchMock.mock.calls[1];
    expect(new Headers(nextRequest?.headers).get('Authorization')).toBe(config.authToken);
  });
});
