const mockListAuthMethods = vi.fn();
const mockAuthWithOAuth2Code = vi.fn();
const mockAuthRefresh = vi.fn();
const mockCancelRequest = vi.fn();

const mockPb = {
  collection: vi.fn(() => ({
    listAuthMethods: mockListAuthMethods,
    authWithOAuth2Code: mockAuthWithOAuth2Code,
    authRefresh: mockAuthRefresh,
  })),
  authStore: {
    token: 'test-token',
    isValid: true,
    record: { id: 'user-123', email: 'test@example.com' },
    clear: vi.fn(),
  },
  buildURL: vi.fn((path: string) => `https://pb.example.test${path}`),
  cancelRequest: mockCancelRequest,
};

const REDIRECT_URL = 'https://pb.example.test/api/gsd/oauth-callback';

const AUTH_METHODS = {
  oauth2: {
    enabled: true,
    providers: ['google', 'github', 'apple'].map((name) => ({
      name,
      displayName: name,
      state: `state-${name}`,
      authURL: `https://accounts.example.test/${name}?client_id=gsd&redirect_uri=`,
      codeVerifier: `verifier-${name}`,
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
    })),
  },
};

const DAY_SECONDS = 24 * 60 * 60;

function tokenExpiringIn(seconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })
  ).toString('base64url');
  return `header.${payload}.signature`;
}

vi.mock('@/lib/sync/pocketbase-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sync/pocketbase-client')>()),
  getPocketBase: vi.fn(() => mockPb),
  clearPocketBase: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => mockLogger,
}));

import {
  loginWithProvider,
  loginWithGoogle,
  loginWithGithub,
  loginWithApple,
  cancelOAuthLogin,
  getOAuthErrorMessage,
  isOAuthCancellation,
  openOAuthPopup,
  refreshAuth,
  refreshAuthOutcome,
  ensureValidAuth,
} from '@/lib/sync/pb-auth';
import { relayOAuthCallback } from '@/lib/sync/oauth-callback';

/** Provider name encoded in a fake authURL. */
function providerOf(url: string): string {
  return new URL(url).pathname.slice(1);
}

/**
 * Stands in for the provider plus the callback page: when sign-in navigates to
 * the provider, relay a code for that flow's state, as the callback page would.
 */
function relayCodeFor(url: string, code = 'auth-code'): void {
  relayOAuthCallback(`code=${code}&state=state-${providerOf(url)}`);
}

function fakePopup(
  onNavigate: (url: string, popup: { closed: boolean }) => void = (url) => relayCodeFor(url)
) {
  const popup = {
    closed: false,
    close: vi.fn(),
    hrefs: [] as string[],
    location: {} as { href: string },
  };
  Object.defineProperty(popup.location, 'href', {
    set(url: string) {
      popup.hrefs.push(url);
      onNavigate(url, popup);
    },
  });
  return popup;
}

function stubWindowOpen(onNavigate: (url: string) => void = relayCodeFor) {
  return vi.spyOn(window, 'open').mockImplementation((url) => {
    onNavigate(String(url));
    return {} as Window;
  });
}

const signedIn = (id: string, email: string) => ({ token: 'tok', record: { id, email } });

describe('Sign in with Apple', () => {
  // The iOS client has always offered Apple and this app never did, so an iOS user who
  // picked it landed on a PocketBase account the web could not reach. The provider is
  // already configured server-side; the whitelist here is what gated it.
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAuthMethods.mockResolvedValue(AUTH_METHODS);
    mockAuthWithOAuth2Code.mockResolvedValue(signedIn('user-1', 'someone@example.com'));
    stubWindowOpen();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should_allow_apple_through_the_provider_whitelist', async () => {
    await expect(loginWithProvider('apple')).resolves.toMatchObject({ isLoggedIn: true });
    expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
      'apple', 'auth-code', 'verifier-apple', REDIRECT_URL, undefined, {}
    );
  });

  it('should_expose_a_loginWithApple_wrapper', async () => {
    await loginWithApple();
    expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
      'apple', expect.any(String), expect.any(String), REDIRECT_URL, undefined, {}
    );
  });

  it('should_still_reject_a_provider_that_is_not_whitelisted', async () => {
    await expect(
      loginWithProvider('facebook' as unknown as Parameters<typeof loginWithProvider>[0])
    ).rejects.toThrow(/not allowed/i);
    expect(mockListAuthMethods).not.toHaveBeenCalled();
  });
});

describe('PocketBase Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPb.authStore.token = tokenExpiringIn(3600);
    mockPb.authStore.isValid = true;
  });

  describe('loginWithProvider', () => {
    beforeEach(() => {
      mockListAuthMethods.mockResolvedValue(AUTH_METHODS);
      mockAuthWithOAuth2Code.mockResolvedValue(signedIn('user-123', 'test@example.com'));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should exchange the relayed code with this flow\'s PKCE verifier', async () => {
      stubWindowOpen();

      const result = await loginWithProvider('google');

      expect(mockPb.collection).toHaveBeenCalledWith('users');
      expect(mockListAuthMethods).toHaveBeenCalledWith({});
      expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
        'google', 'auth-code', 'verifier-google', REDIRECT_URL, undefined, {}
      );
      expect(result).toEqual({
        isLoggedIn: true,
        userId: 'user-123',
        email: 'test@example.com',
        provider: 'google',
      });
    });

    it('should send a pre-opened popup to the provider with the encoded redirect URL', async () => {
      const popup = fakePopup();

      await loginWithProvider('google', {
        popupWindow: popup as unknown as Window,
        requestKey: 'oauth_google_test',
      });

      expect(popup.hrefs).toEqual([
        `https://accounts.example.test/google?client_id=gsd&redirect_uri=${encodeURIComponent(REDIRECT_URL)}`,
      ]);
      expect(mockListAuthMethods).toHaveBeenCalledWith({ requestKey: 'oauth_google_test' });
      expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
        'google', 'auth-code', 'verifier-google', REDIRECT_URL, undefined,
        { requestKey: 'oauth_google_test' }
      );
    });

    it('should ignore a code relayed for another state (SEC-001)', async () => {
      // A crafted provider link lands this browser's callback page with an
      // attacker's state. Only the code for this tab's own state may be exchanged.
      stubWindowOpen((url) => {
        relayOAuthCallback('code=not-ours&state=attacker-state');
        relayCodeFor(url, 'ours');
      });

      await loginWithProvider('github');

      expect(mockAuthWithOAuth2Code).toHaveBeenCalledOnce();
      expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
        'github', 'ours', 'verifier-github', REDIRECT_URL, undefined, {}
      );
    });

    it('should reject when the provider returns an error for this flow', async () => {
      stubWindowOpen((url) => {
        relayOAuthCallback(`error=access_denied&state=state-${providerOf(url)}`);
      });

      await expect(loginWithProvider('google')).rejects.toThrow(/access_denied/);
      expect(mockAuthWithOAuth2Code).not.toHaveBeenCalled();
    });

    it.each(['access_denied', 'user_cancelled_authorize'])(
      'should treat a provider %s as the user cancelling',
      async (providerError) => {
        stubWindowOpen((url) => {
          relayOAuthCallback(`error=${providerError}&state=state-${providerOf(url)}`);
        });

        const error = await loginWithProvider('google').catch((caught: unknown) => caught);

        expect(isOAuthCancellation(error)).toBe(true);
      }
    );

    it('should not treat other provider errors or a timeout as cancelling', async () => {
      stubWindowOpen((url) => {
        relayOAuthCallback(`error=server_error&state=state-${providerOf(url)}`);
      });

      const error = await loginWithProvider('google').catch((caught: unknown) => caught);

      expect(isOAuthCancellation(error)).toBe(false);
      expect(isOAuthCancellation(new Error('OAuth sign-in timed out.'))).toBe(false);
    });

    it('should close a pre-opened popup after successful OAuth handoff', async () => {
      const popup = fakePopup();

      await loginWithProvider('google', { popupWindow: popup as unknown as Window });

      expect(popup.close).toHaveBeenCalledOnce();
    });

    it('should not close a popup the browser already reports as closed', async () => {
      // accounts.google.com serves Cross-Origin-Opener-Policy: same-origin, which
      // swaps the browsing context group and severs our handle once the popup
      // navigates there. Chrome then reports the popup as closed and refuses
      // close(), logging a COOP violation for a call that could not do anything.
      const popup = fakePopup((url, handle) => {
        handle.closed = true;
        relayCodeFor(url);
      });

      await loginWithProvider('google', { popupWindow: popup as unknown as Window });

      expect(popup.close).not.toHaveBeenCalled();
    });

    it('should reject when the popup closed before sign-in started', async () => {
      const popup = fakePopup();
      popup.closed = true;

      await expect(
        loginWithProvider('google', { popupWindow: popup as unknown as Window })
      ).rejects.toThrow(/closed before authentication started/);
      expect(mockAuthWithOAuth2Code).not.toHaveBeenCalled();
    });

    it('should cancel the PocketBase request when OAuth times out', async () => {
      vi.useFakeTimers();
      try {
        stubWindowOpen(() => {});

        const promise = loginWithProvider('github', {
          requestKey: 'oauth_github_timeout',
          timeoutMs: 50,
        });
        const assertion = expect(promise).rejects.toThrow(/timed out/i);

        await vi.advanceTimersByTimeAsync(50);

        await assertion;
        expect(mockCancelRequest).toHaveBeenCalledWith('oauth_github_timeout');
        expect(mockAuthWithOAuth2Code).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should still accept a code three minutes after sign-in started', async () => {
      // A 2FA prompt or a password manager detour runs past two minutes. The
      // old limit failed those sign-ins after the user had finished them.
      const THREE_MINUTES_MS = 3 * 60 * 1000;
      vi.useFakeTimers();
      try {
        let providerUrl = '';
        stubWindowOpen((url) => {
          providerUrl = url;
        });

        const promise = loginWithProvider('github');
        await vi.advanceTimersByTimeAsync(THREE_MINUTES_MS);
        relayCodeFor(providerUrl);

        await expect(promise).resolves.toMatchObject({ isLoggedIn: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should report a cancelled sign-in as cancelled', async () => {
      stubWindowOpen(() => {
        cancelOAuthLogin('oauth_google_cancel');
      });

      const error = await loginWithProvider('google', { requestKey: 'oauth_google_cancel' })
        .catch((caught: unknown) => caught);

      expect(getOAuthErrorMessage(error)).toMatch(/cancelled/i);
      expect(isOAuthCancellation(error)).toBe(true);
      // A cancel is the user's choice, so it isn't logged as an error.
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockCancelRequest).toHaveBeenCalledWith('oauth_google_cancel');
      expect(mockAuthWithOAuth2Code).not.toHaveBeenCalled();
    });

    it('should reject when the server does not offer the provider', async () => {
      mockListAuthMethods.mockResolvedValue({ oauth2: { enabled: true, providers: [] } });

      await expect(loginWithProvider('google')).rejects.toThrow(/not configured on the server/);
    });

    it('should rethrow errors from the code exchange', async () => {
      stubWindowOpen();
      mockAuthWithOAuth2Code.mockRejectedValue(new Error('Code exchange failed'));

      await expect(loginWithProvider('github')).rejects.toThrow('Code exchange failed');
    });

    it('rejects provider names not in the runtime whitelist', async () => {
      // `OAuthProvider` is a TS type — erased at runtime. A caller (XSS
      // payload, future feature regression, console invocation) could pass
      // an arbitrary string. The runtime allowlist must catch this before
      // the SDK call is made.
      await expect(
        loginWithProvider('facebook' as unknown as 'google')
      ).rejects.toThrow(/not allowed|whitelist|provider/i);
      expect(mockListAuthMethods).not.toHaveBeenCalled();
    });

    it('rejects empty/null provider strings', async () => {
      await expect(
        loginWithProvider('' as unknown as 'google')
      ).rejects.toThrow();
      await expect(
        loginWithProvider(null as unknown as 'google')
      ).rejects.toThrow();
      expect(mockListAuthMethods).not.toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should call loginWithProvider with google', async () => {
      mockListAuthMethods.mockResolvedValue(AUTH_METHODS);
      mockAuthWithOAuth2Code.mockResolvedValue(signedIn('user-123', 'test@example.com'));
      stubWindowOpen();

      const result = await loginWithGoogle();

      expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
        'google', 'auth-code', 'verifier-google', REDIRECT_URL, undefined, {}
      );
      expect(result.provider).toBe('google');
    });
  });

  describe('loginWithGithub', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should call loginWithProvider with github', async () => {
      mockListAuthMethods.mockResolvedValue(AUTH_METHODS);
      mockAuthWithOAuth2Code.mockResolvedValue(signedIn('user-456', 'dev@github.com'));
      stubWindowOpen();

      const result = await loginWithGithub();

      expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
        'github', 'auth-code', 'verifier-github', REDIRECT_URL, undefined, {}
      );
      expect(result.provider).toBe('github');
    });
  });

  describe('refreshAuth', () => {
    it('should return true on successful refresh', async () => {
      mockAuthRefresh.mockResolvedValue({});

      const result = await refreshAuth();

      expect(mockPb.collection).toHaveBeenCalledWith('users');
      expect(mockAuthRefresh).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when refresh fails', async () => {
      mockAuthRefresh.mockRejectedValue(new Error('Token expired'));

      const result = await refreshAuth();

      expect(result).toBe(false);
    });

    it('should return false early when there is no token', async () => {
      mockPb.authStore.token = '';

      const result = await refreshAuth();

      expect(mockAuthRefresh).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  // Account deletion needs to tell a dead session from an unreachable server,
  // so it can say "sign in again" only when signing in would help.
  describe('refreshAuthOutcome', () => {
    it('reports refreshed on success', async () => {
      mockAuthRefresh.mockResolvedValue({});

      await expect(refreshAuthOutcome()).resolves.toBe('refreshed');
    });

    it('reports no-session without a token', async () => {
      mockPb.authStore.token = '';

      await expect(refreshAuthOutcome()).resolves.toBe('no-session');
      expect(mockAuthRefresh).not.toHaveBeenCalled();
    });

    it('reports rejected when the server refuses the token', async () => {
      mockAuthRefresh.mockRejectedValue(
        Object.assign(new Error('The request requires valid record authorization token.'), { status: 401 }),
      );

      await expect(refreshAuthOutcome()).resolves.toBe('rejected');
    });

    it('reports unreachable when the request never got a response', async () => {
      mockAuthRefresh.mockRejectedValue(Object.assign(new Error('Something went wrong.'), { status: 0 }));

      await expect(refreshAuthOutcome()).resolves.toBe('unreachable');
    });

    it('reports unreachable for a server error whose message names no status', async () => {
      mockAuthRefresh.mockRejectedValue(
        Object.assign(new Error('Something went wrong while processing your request.'), { status: 503 }),
      );

      await expect(refreshAuthOutcome()).resolves.toBe('unreachable');
    });

    // A revoked token that hasn't expired would otherwise stay "signed in" here
    // until it expires, and the sync dialog would never offer sign-in.
    it('forgets a token the server refuses with a 401', async () => {
      mockAuthRefresh.mockRejectedValue(
        Object.assign(new Error('The request requires valid record authorization token.'), { status: 401 }),
      );

      await expect(refreshAuthOutcome()).resolves.toBe('rejected');
      expect(mockPb.authStore.clear).toHaveBeenCalledOnce();
    });

    it('keeps a token that a sign-in saved while the refusal was in flight', async () => {
      mockAuthRefresh.mockImplementationOnce(async () => {
        mockPb.authStore.token = 'token-from-a-new-sign-in';
        throw Object.assign(new Error('The request requires valid record authorization token.'), { status: 401 });
      });

      await expect(refreshAuthOutcome()).resolves.toBe('rejected');
      expect(mockPb.authStore.clear).not.toHaveBeenCalled();
    });

    it.each([
      ['no answer', Object.assign(new Error('Something went wrong.'), { status: 0 })],
      ['a failure that is no verdict on the token', new Error('refresh rejected')],
      ['a 403 from a proxy or firewall', Object.assign(new Error('Forbidden'), { status: 403 })],
    ])('keeps the token after %s', async (_name, failure) => {
      mockAuthRefresh.mockRejectedValue(failure);

      await refreshAuthOutcome();

      expect(mockPb.authStore.clear).not.toHaveBeenCalled();
    });
  });

  describe('ensureValidAuth', () => {
    it('returns true without refreshing while more than 7 days remain', async () => {
      mockPb.authStore.isValid = true;
      mockPb.authStore.token = tokenExpiringIn(8 * DAY_SECONDS);

      const result = await ensureValidAuth();

      expect(result).toBe(true);
      expect(mockAuthRefresh).not.toHaveBeenCalled();
    });

    it('refreshes a valid token once 7 days or fewer remain, as iOS and Android do', async () => {
      // A web session must slide like the native ones: with a 30-day server
      // token, any visit in the last week renews it, so a regular user is
      // never signed out. A 5-minute window meant it almost never renewed.
      mockPb.authStore.isValid = true;
      mockPb.authStore.token = tokenExpiringIn(6 * DAY_SECONDS);
      mockAuthRefresh.mockResolvedValue({});

      const result = await ensureValidAuth();

      expect(mockAuthRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('keeps a still-valid token when the early refresh is unreachable', async () => {
      // Offline or a 5xx says nothing about the session; the token works for days.
      mockPb.authStore.isValid = true;
      mockPb.authStore.token = tokenExpiringIn(6 * DAY_SECONDS);
      mockAuthRefresh.mockRejectedValue(
        Object.assign(new Error('Something went wrong while processing your request.'), { status: 503 }),
      );

      const result = await ensureValidAuth();

      expect(mockAuthRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('reports failure when the server rejects the early refresh', async () => {
      // A 401 on a token that hasn't expired means the session was revoked
      // (for example by "Sign out of all devices"), so it isn't usable.
      mockPb.authStore.isValid = true;
      mockPb.authStore.token = tokenExpiringIn(6 * DAY_SECONDS);
      mockAuthRefresh.mockRejectedValue(
        Object.assign(new Error('The request requires valid record authorization token.'), { status: 401 }),
      );

      const result = await ensureValidAuth();

      expect(mockAuthRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });

    it('proactively refreshes a valid token near expiry', async () => {
      mockPb.authStore.isValid = true;
      mockPb.authStore.token = tokenExpiringIn(60);
      mockAuthRefresh.mockResolvedValue({});

      const result = await ensureValidAuth();

      expect(mockAuthRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('attempts a silent refresh when the token is expired but present', async () => {
      mockPb.authStore.isValid = false;
      mockPb.authStore.token = 'expired-but-present';
      mockAuthRefresh.mockResolvedValue({});

      const result = await ensureValidAuth();

      expect(mockAuthRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('reports failure cleanly when the silent refresh fails', async () => {
      mockPb.authStore.isValid = false;
      mockPb.authStore.token = 'expired-but-present';
      mockAuthRefresh.mockRejectedValue(new Error('refresh rejected'));

      const result = await ensureValidAuth();

      expect(result).toBe(false);
    });

    it('returns false without refreshing when there is no token at all', async () => {
      mockPb.authStore.isValid = false;
      mockPb.authStore.token = '';

      const result = await ensureValidAuth();

      expect(mockAuthRefresh).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('openOAuthPopup', () => {
    it('opens a named OAuth popup window', () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

      openOAuthPopup('google');

      expect(openSpy).toHaveBeenCalledWith(
        'about:blank',
        'gsd_oauth_google',
        expect.stringContaining('menubar=no')
      );
      openSpy.mockRestore();
    });
  });

  describe('getOAuthErrorMessage', () => {
    it('uses PocketBase diagnostic messages when available', () => {
      const message = getOAuthErrorMessage({
        message: 'Outer message',
        response: { message: 'Provider redirect failed' },
      });

      expect(message).toBe('Provider redirect failed');
    });

    it('returns a friendly cancellation message for aborts', () => {
      expect(getOAuthErrorMessage({ isAbort: true, message: 'aborted' })).toMatch(/cancelled/i);
    });
  });
});
