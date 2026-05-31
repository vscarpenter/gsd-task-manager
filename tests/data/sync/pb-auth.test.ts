const mockAuthWithOAuth2 = vi.fn();
const mockAuthRefresh = vi.fn();
const mockCancelRequest = vi.fn();

const mockPb = {
  collection: vi.fn(() => ({
    authWithOAuth2: mockAuthWithOAuth2,
    authRefresh: mockAuthRefresh,
  })),
  authStore: {
    token: 'test-token',
    isValid: true,
    record: { id: 'user-123', email: 'test@example.com' },
  },
  cancelRequest: mockCancelRequest,
};

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(() => mockPb),
  clearPocketBase: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  loginWithProvider,
  loginWithGoogle,
  loginWithGithub,
  getOAuthErrorMessage,
  openOAuthPopup,
  refreshAuth,
} from '@/lib/sync/pb-auth';

describe('PocketBase Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPb.authStore.token = 'test-token';
  });

  describe('loginWithProvider', () => {
    it('should return AuthState on successful login', async () => {
      mockAuthWithOAuth2.mockResolvedValue({
        record: { id: 'user-123', email: 'test@example.com' },
      });

      const result = await loginWithProvider('google');

      expect(mockPb.collection).toHaveBeenCalledWith('users');
      expect(mockAuthWithOAuth2).toHaveBeenCalledWith({ provider: 'google' });
      expect(result).toEqual({
        isLoggedIn: true,
        userId: 'user-123',
        email: 'test@example.com',
        provider: 'google',
      });
    });

    it('should pass a pre-opened popup through urlCallback', async () => {
      mockAuthWithOAuth2.mockResolvedValue({
        record: { id: 'user-123', email: 'test@example.com' },
      });
      const popupWindow = {
        closed: false,
        location: { href: '' },
      } as unknown as Window;

      await loginWithProvider('google', {
        popupWindow,
        requestKey: 'oauth_google_test',
      });

      const options = mockAuthWithOAuth2.mock.calls[0][0];
      expect(options).toEqual(
        expect.objectContaining({
          provider: 'google',
          requestKey: 'oauth_google_test',
          urlCallback: expect.any(Function),
        })
      );

      options.urlCallback('https://accounts.example.test/auth');
      expect(popupWindow.location.href).toBe('https://accounts.example.test/auth');
    });

    it('should close a pre-opened popup after successful OAuth handoff', async () => {
      mockAuthWithOAuth2.mockResolvedValue({
        record: { id: 'user-123', email: 'test@example.com' },
      });
      const close = vi.fn();
      const popupWindow = {
        closed: false,
        location: { href: '' },
        close,
      } as unknown as Window;

      await loginWithProvider('google', { popupWindow });

      expect(close).toHaveBeenCalledOnce();
    });

    it('should cancel the PocketBase request when OAuth times out', async () => {
      vi.useFakeTimers();
      try {
        mockAuthWithOAuth2.mockReturnValue(new Promise(() => {}));

        const promise = loginWithProvider('github', {
          requestKey: 'oauth_github_timeout',
          timeoutMs: 50,
        });
        const assertion = expect(promise).rejects.toThrow(/timed out/i);

        await vi.advanceTimersByTimeAsync(50);

        await assertion;
        expect(mockCancelRequest).toHaveBeenCalledWith('oauth_github_timeout');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should rethrow errors from OAuth2', async () => {
      const oauthError = new Error('OAuth popup closed');
      mockAuthWithOAuth2.mockRejectedValue(oauthError);

      await expect(loginWithProvider('github')).rejects.toThrow('OAuth popup closed');
    });

    it('rejects provider names not in the runtime whitelist', async () => {
      // `OAuthProvider` is a TS type — erased at runtime. A caller (XSS
      // payload, future feature regression, console invocation) could pass
      // an arbitrary string. The runtime allowlist must catch this before
      // the SDK call is made.
      await expect(
        loginWithProvider('facebook' as unknown as 'google')
      ).rejects.toThrow(/not allowed|whitelist|provider/i);
      expect(mockAuthWithOAuth2).not.toHaveBeenCalled();
    });

    it('rejects empty/null provider strings', async () => {
      await expect(
        loginWithProvider('' as unknown as 'google')
      ).rejects.toThrow();
      await expect(
        loginWithProvider(null as unknown as 'google')
      ).rejects.toThrow();
      expect(mockAuthWithOAuth2).not.toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle', () => {
    it('should call loginWithProvider with google', async () => {
      mockAuthWithOAuth2.mockResolvedValue({
        record: { id: 'user-123', email: 'test@example.com' },
      });

      const result = await loginWithGoogle();

      expect(mockAuthWithOAuth2).toHaveBeenCalledWith({ provider: 'google' });
      expect(result.provider).toBe('google');
    });
  });

  describe('loginWithGithub', () => {
    it('should call loginWithProvider with github', async () => {
      mockAuthWithOAuth2.mockResolvedValue({
        record: { id: 'user-456', email: 'dev@github.com' },
      });

      const result = await loginWithGithub();

      expect(mockAuthWithOAuth2).toHaveBeenCalledWith({ provider: 'github' });
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
