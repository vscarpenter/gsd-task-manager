const mockAuthWithOAuth2 = vi.fn();
const mockAuthRefresh = vi.fn();

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
};

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(() => mockPb),
  clearPocketBase: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  loginWithProvider,
  loginWithGoogle,
  loginWithGithub,
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

    it('should rethrow errors from OAuth2', async () => {
      const oauthError = new Error('OAuth popup closed');
      mockAuthWithOAuth2.mockRejectedValue(oauthError);

      await expect(loginWithProvider('github')).rejects.toThrow('OAuth popup closed');
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
});
