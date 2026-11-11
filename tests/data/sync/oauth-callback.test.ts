import {
  parseOAuthCallback,
  relayOAuthCallback,
  waitForOAuthCallback,
} from '@/lib/sync/oauth-callback';

describe('parseOAuthCallback', () => {
  it('reads code, state, and error from the callback fragment', () => {
    expect(parseOAuthCallback('code=abc&state=s1')).toEqual({ code: 'abc', state: 's1' });
    expect(parseOAuthCallback('error=access_denied&state=s1')).toEqual({
      error: 'access_denied',
      state: 's1',
    });
  });

  it('returns null without a state, since no sign-in could claim it', () => {
    expect(parseOAuthCallback('code=abc')).toBeNull();
    expect(parseOAuthCallback('')).toBeNull();
  });

  it('drops oversized values', () => {
    const huge = 'x'.repeat(2049);
    expect(parseOAuthCallback(`state=${huge}&code=abc`)).toBeNull();
    expect(parseOAuthCallback(`state=s1&code=${huge}`)).toEqual({ state: 's1' });
  });
});

describe('waitForOAuthCallback', () => {
  it('resolves with the code relayed for its own state', async () => {
    const wait = waitForOAuthCallback('state-a', new AbortController().signal);

    const relayed = relayOAuthCallback('code=abc&state=state-a');

    await expect(wait).resolves.toBe('abc');
    await expect(relayed).resolves.toBe('delivered');
  });

  it('ignores a code relayed for another state (SEC-001)', async () => {
    // A crafted provider link can land this browser on the callback page with
    // an attacker's state. Only the tab holding the matching state may use a code.
    const wait = waitForOAuthCallback('state-a', new AbortController().signal);

    relayOAuthCallback('code=not-ours&state=attacker-state');
    relayOAuthCallback('code=ours&state=state-a');

    await expect(wait).resolves.toBe('ours');
  });

  it('rejects when the provider returned an error for its state', async () => {
    const wait = waitForOAuthCallback('state-a', new AbortController().signal);

    relayOAuthCallback('error=access_denied&state=state-a');

    await expect(wait).rejects.toMatchObject({
      message: expect.stringMatching(/access_denied/),
      providerError: 'access_denied',
    });
  });

  it('rejects with the abort reason when the signal aborts', async () => {
    const controller = new AbortController();
    const wait = waitForOAuthCallback('state-a', controller.signal);

    controller.abort(new Error('cancelled by test'));

    await expect(wait).rejects.toThrow('cancelled by test');
  });

  it('rejects immediately for an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already gone'));

    await expect(waitForOAuthCallback('state-a', controller.signal)).rejects.toThrow('already gone');
  });
});

describe('relayOAuthCallback', () => {
  const SHORT_ACK_WAIT_MS = 20;

  it('reports invalid when the fragment has no state', async () => {
    await expect(relayOAuthCallback('code=abc')).resolves.toBe('invalid');
  });

  it('reports delivered when the waiting tab takes a provider error', async () => {
    const wait = waitForOAuthCallback('state-a', new AbortController().signal);
    wait.catch(() => {});

    await expect(relayOAuthCallback('error=access_denied&state=state-a')).resolves.toBe('delivered');
  });

  it('reports unclaimed when no tab is waiting for that state', async () => {
    // The sign-in timed out, was cancelled, or its tab is gone. The callback
    // page needs to know, so it can say so and stay open.
    const other = waitForOAuthCallback('state-b', new AbortController().signal);
    other.catch(() => {});

    await expect(
      relayOAuthCallback('code=abc&state=state-a', SHORT_ACK_WAIT_MS)
    ).resolves.toBe('unclaimed');
  });
});
